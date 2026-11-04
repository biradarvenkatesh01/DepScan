import axios from 'axios';
import semver from 'semver';

const MAX_DEPTH = 3;

// In-memory caches for NPM and PyPI registry metadata
const npmCache = new Map();
const pypiCache = new Map();

/**
 * Fetch package metadata from NPM Registry (cached)
 */
async function fetchNpmMetadata(packageName) {
  if (npmCache.has(packageName)) {
    return npmCache.get(packageName);
  }
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await axios.get(url, { timeout: 8000 });
    npmCache.set(packageName, response.data);
    return response.data;
  } catch (error) {
    // Return null if package not found or error
    npmCache.set(packageName, null);
    return null;
  }
}

/**
 * Fetch package metadata from PyPI Registry (cached)
 */
async function fetchPypiMetadata(packageName) {
  const normalizedName = packageName.toLowerCase().replace(/_/g, '-');
  if (pypiCache.has(normalizedName)) {
    return pypiCache.get(normalizedName);
  }
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const response = await axios.get(url, { timeout: 8000 });
    pypiCache.set(normalizedName, response.data);
    return response.data;
  } catch (error) {
    pypiCache.set(normalizedName, null);
    return null;
  }
}

/**
 * Resolves the concrete version of an NPM package matching a version range,
 * and recursively gathers its transitive dependencies.
 */
async function resolveNpmTransitive(packageName, range, depth, resolvedList, visited, parent = null) {
  const visitKey = `${packageName}@${range}`;
  if (visited.has(visitKey) || depth > MAX_DEPTH) return;
  visited.add(visitKey);

  const metadata = await fetchNpmMetadata(packageName);
  if (!metadata || !metadata.versions) return;

  const versions = Object.keys(metadata.versions);
  
  // Clean range for semver parsing (e.g. handle urls or github links if any, fallback)
  let cleanRange = range;
  if (range.includes('://') || range.startsWith('git') || range.includes('/')) {
    // If it's a URL or Git repo, we can't easily resolve version range, fallback to latest
    cleanRange = '*';
  }

  // Resolve best matching version
  let concreteVersion = semver.maxSatisfying(versions, cleanRange);
  if (!concreteVersion) {
    // Fallback to latest tag or first available
    concreteVersion = metadata['dist-tags']?.latest || versions[versions.length - 1];
  }

  if (!concreteVersion) return;

  const uniqueId = `${packageName}@${concreteVersion}`;
  if (resolvedList.has(uniqueId)) return;

  resolvedList.set(uniqueId, {
    name: packageName,
    version: concreteVersion,
    ecosystem: 'npm',
    direct: depth === 1,
    parent
  });

  // Fetch transitive dependencies of this concrete version
  const versionData = metadata.versions[concreteVersion];
  if (versionData && versionData.dependencies) {
    const deps = versionData.dependencies;
    const promises = Object.entries(deps).map(([depName, depRange]) =>
      resolveNpmTransitive(depName, depRange, depth + 1, resolvedList, visited, packageName)
    );
    await Promise.all(promises);
  }
}

/**
 * Resolves the concrete version of a Python package matching a requirement,
 * and recursively gathers its transitive dependencies.
 */
async function resolvePypiTransitive(packageName, specifiers, depth, resolvedList, visited, parent = null) {
  const normalizedName = packageName.toLowerCase().replace(/_/g, '-');
  const visitKey = `${normalizedName}@${specifiers}`;
  if (visited.has(visitKey) || depth > MAX_DEPTH) return;
  visited.add(visitKey);

  const metadata = await fetchPypiMetadata(packageName);
  if (!metadata || !metadata.releases) return;

  const releases = Object.keys(metadata.releases);
  let concreteVersion = null;

  // Simple resolution logic for Python version specifiers
  // Parse common specifiers: ==version or >=version
  const eqMatch = specifiers.match(/==\s*([0-9a-zA-Z\.\-\_]+)/);
  const geMatch = specifiers.match(/>=\s*([0-9a-zA-Z\.\-\_]+)/);

  if (eqMatch) {
    concreteVersion = eqMatch[1].trim();
  } else if (geMatch) {
    const minVersion = geMatch[1].trim();
    // Sort versions and find the highest one that is >= minVersion
    // For simplicity, find releases matching minVersion or just pick the latest release from pypi metadata
    concreteVersion = metadata.info?.version || releases[releases.length - 1];
  } else {
    // Default to the latest release
    concreteVersion = metadata.info?.version || releases[releases.length - 1];
  }

  if (!concreteVersion || !metadata.releases[concreteVersion]) {
    // Fallback to latest release if exact version isn't found
    concreteVersion = metadata.info?.version || releases[releases.length - 1];
  }

  if (!concreteVersion) return;

  const uniqueId = `${normalizedName}@${concreteVersion}`;
  if (resolvedList.has(uniqueId)) return;

  resolvedList.set(uniqueId, {
    name: normalizedName,
    version: concreteVersion,
    ecosystem: 'PyPI',
    direct: depth === 1,
    parent
  });

  // Fetch info for this concrete version to get its dependencies (requires_dist)
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(normalizedName)}/${encodeURIComponent(concreteVersion)}/json`;
    const response = await axios.get(url, { timeout: 8000 });
    const versionInfo = response.data;
    const requiresDist = versionInfo.info?.requires_dist;

    if (requiresDist && Array.isArray(requiresDist)) {
      const promises = [];
      for (const dist of requiresDist) {
        // Parse python dependency requirement format, e.g. "urllib3 (<1.27,>=1.21.1)" or "requests ; extra == 'security'"
        // Ignore optional dependencies (extras) to keep dependency tree clean and focused on main path
        if (dist.includes('; extra ==') || dist.includes('extra ==')) continue;

        // Parse package name and version range
        // Format is: package-name (range)
        const match = dist.match(/^([a-zA-Z0-9_\-\.]+)(?:\s*\(([^)]+)\))?/);
        if (match) {
          const depName = match[1];
          const depSpecifiers = match[2] || '';
          promises.push(resolvePypiTransitive(depName, depSpecifiers, depth + 1, resolvedList, visited, normalizedName));
        }
      }
      await Promise.all(promises);
    }
  } catch (error) {
    // If specific version endpoint fails, we just don't resolve further for this branch
  }
}

/**
 * Parses a package.json file and resolves direct + transitive dependencies
 */
async function parsePackageJson(jsonContent) {
  const data = JSON.parse(jsonContent);
  const directDeps = {
    ...(data.dependencies || {}),
    ...(data.devDependencies || {})
  };

  const resolvedList = new Map();
  const visited = new Set();

  const promises = Object.entries(directDeps).map(([name, range]) =>
    resolveNpmTransitive(name, range, 1, resolvedList, visited)
  );

  await Promise.all(promises);
  return Array.from(resolvedList.values());
}

/**
 * Parses a package-lock.json file (extracts complete dependency tree locally)
 */
function parsePackageLock(jsonContent) {
  const data = JSON.parse(jsonContent);
  const resolvedList = new Map();

  // Modern v2 and v3 package-lock files use "packages"
  if (data.packages) {
    const entries = data.packages;
    const nameOf = key => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const depsOf = pkg => Object.keys({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.optionalDependencies || {})
    });

    // Mirrors Node's lookup: <from>/node_modules/<dep>, then each ancestor up to the root
    const resolveKey = (fromKey, dep) => {
      let base = fromKey;
      for (;;) {
        const candidate = `${base ? base + '/' : ''}node_modules/${dep}`;
        if (entries[candidate]) return candidate;
        if (!base) return null;
        const cut = base.lastIndexOf('/node_modules/');
        base = cut === -1 ? '' : base.slice(0, cut);
      }
    };

    // Breadth-first from the root so every package gets its shortest introducing parent
    const parentOf = new Map();
    const rootDeps = new Set();
    const queue = [];
    for (const dep of depsOf(entries[''] || {})) {
      const key = resolveKey('', dep);
      if (key && !parentOf.has(key)) {
        parentOf.set(key, null);
        rootDeps.add(key);
        queue.push(key);
      }
    }
    while (queue.length) {
      const key = queue.shift();
      for (const dep of depsOf(entries[key])) {
        const child = resolveKey(key, dep);
        if (child && !parentOf.has(child)) {
          parentOf.set(child, nameOf(key));
          queue.push(child);
        }
      }
    }

    // Visit reachable packages first (in BFS order), then anything orphaned
    const ordered = [...parentOf.keys(), ...Object.keys(entries).filter(k => !parentOf.has(k))];
    for (const key of ordered) {
      const pkg = entries[key];
      if (key === '' || !pkg?.version || pkg.link) continue;
      const name = nameOf(key);
      if (!name) continue;

      const uniqueId = `${name}@${pkg.version}`;
      if (resolvedList.has(uniqueId)) continue;
      resolvedList.set(uniqueId, {
        name,
        version: pkg.version,
        ecosystem: 'npm',
        direct: rootDeps.has(key),
        parent: parentOf.get(key) ?? null
      });
    }
  } 
  // Legacy v1 format uses "dependencies" object recursively
  else if (data.dependencies) {
    // v1 hoists transitive packages to the top level, so a top-level entry is
    // only "direct" when no other package lists it under `requires`
    const required = new Set();
    const collectRequires = (deps) => {
      for (const dep of Object.values(deps)) {
        Object.keys(dep.requires || {}).forEach(n => required.add(n));
        if (dep.dependencies) collectRequires(dep.dependencies);
      }
    };
    collectRequires(data.dependencies);

    const traverse = (deps, parent) => {
      for (const [name, dep] of Object.entries(deps)) {
        if (!dep.version) continue;
        const uniqueId = `${name}@${dep.version}`;
        resolvedList.set(uniqueId, {
          name,
          version: dep.version,
          ecosystem: 'npm',
          direct: parent === null && !required.has(name),
          parent
        });
        if (dep.dependencies) {
          traverse(dep.dependencies, name);
        }
      }
    };
    traverse(data.dependencies, null);
  }

  return Array.from(resolvedList.values());
}

/**
 * Parses requirements.txt and resolves direct + transitive dependencies
 */
async function parseRequirementsTxt(content) {
  const lines = content.split(/\r?\n/);
  const resolvedList = new Map();
  const visited = new Set();
  const promises = [];

  for (const line of lines) {
    let cleanLine = line.trim();
    // Skip comments and empty lines
    if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('-r')) continue;

    // Remove line comments or environment markers (split by ';' or '#')
    const semiIdx = cleanLine.indexOf(';');
    if (semiIdx !== -1) cleanLine = cleanLine.substring(0, semiIdx).trim();

    const hashIdx = cleanLine.indexOf('#');
    if (hashIdx !== -1) cleanLine = cleanLine.substring(0, hashIdx).trim();

    if (!cleanLine) continue;

    // Parse package name and version range
    // Requirements file version operators: ==, >=, <=, >, <, ~=, !=
    const match = cleanLine.match(/^([a-zA-Z0-9_\-\.]+)(.*)$/);
    if (match) {
      const packageName = match[1].trim();
      const specifiers = match[2].trim();
      promises.push(resolvePypiTransitive(packageName, specifiers, 1, resolvedList, visited));
    }
  }

  await Promise.all(promises);
  return Array.from(resolvedList.values());
}

/**
 * Main parser entry point
 */
export async function parseDependencyFile(fileName, fileContent) {
  const nameLower = fileName.toLowerCase();
  
  if (nameLower === 'package.json') {
    return await parsePackageJson(fileContent);
  } else if (nameLower === 'package-lock.json') {
    return parsePackageLock(fileContent);
  } else if (nameLower === 'requirements.txt') {
    return await parseRequirementsTxt(fileContent);
  } else {
    throw new Error('Unsupported dependency file format. Please upload package.json, package-lock.json, or requirements.txt.');
  }
}
