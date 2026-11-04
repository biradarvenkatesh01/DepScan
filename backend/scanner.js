import axios from 'axios';
import semver from 'semver';

/**
 * Split array into chunks of a specific size
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Advisory records rarely change, so cache them for the life of the process
const vulnCache = new Map();
const DETAIL_CONCURRENCY = 16;

/**
 * Fetches full OSV advisory records by ID with a small worker pool.
 * Returns a Map of id -> record; failed lookups are simply omitted.
 */
async function fetchVulnDetails(ids) {
  const results = new Map();
  const pending = [];
  for (const id of ids) {
    if (vulnCache.has(id)) results.set(id, vulnCache.get(id));
    else pending.push(id);
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++];
      try {
        const response = await axios.get(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { timeout: 10000 });
        vulnCache.set(id, response.data);
        results.set(id, response.data);
      } catch (error) {
        console.error(`Error fetching OSV advisory ${id}:`, error.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, pending.length) }, worker));
  return results;
}

/**
 * Computes a CVSS v3 base score from a vector string such as
 * CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
 */
function cvss3BaseScore(vector) {
  const m = Object.fromEntries(vector.split('/').slice(1).map(p => p.split(':')));
  const W = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
    AC: { L: 0.77, H: 0.44 },
    UI: { N: 0.85, R: 0.62 },
    CIA: { H: 0.56, L: 0.22, N: 0 },
  };
  const changed = m.S === 'C';
  const PR = { N: 0.85, L: changed ? 0.68 : 0.62, H: changed ? 0.5 : 0.27 }[m.PR];
  const av = W.AV[m.AV], ac = W.AC[m.AC], ui = W.UI[m.UI];
  const c = W.CIA[m.C], i = W.CIA[m.I], a = W.CIA[m.A];
  if ([PR, av, ac, ui, c, i, a].some(x => x === undefined)) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  if (impact <= 0) return 0;
  const exploitability = 8.22 * av * ac * PR * ui;
  const raw = changed ? Math.min(1.08 * (impact + exploitability), 10) : Math.min(impact + exploitability, 10);
  return Math.ceil(raw * 10) / 10;
}

/**
 * Extracts CVSS Score and Level from OSV vulnerability record.
 * Returns { score: number, level: string }
 */
function parseSeverity(vuln) {
  let score = null;
  let vector = null;

  // 1. Check in standard vuln.severity array
  if (vuln.severity && Array.isArray(vuln.severity)) {
    const cvssV3 = vuln.severity.find(s => s.type === 'CVSS_V3');
    if (cvssV3 && cvssV3.score) {
      vector = cvssV3.score;
    } else {
      const cvssV2 = vuln.severity.find(s => s.type === 'CVSS_V2');
      if (cvssV2 && cvssV2.score) {
        vector = cvssV2.score;
      }
    }
  }

  // 2. Check in database_specific.cvss object
  if (!vector && vuln.database_specific && vuln.database_specific.cvss) {
    if (vuln.database_specific.cvss.score) {
      score = parseFloat(vuln.database_specific.cvss.score);
    }
    if (vuln.database_specific.cvss.vectorString) {
      vector = vuln.database_specific.cvss.vectorString;
    }
  }

  // 3. Try parsing CVSS vector to extract score if vector is found (e.g. CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
  if (score === null && vector && /^CVSS:3/.test(vector)) {
    score = cvss3BaseScore(vector);
  }
  if (score === null && vector) {
    // If vector is a number already, e.g. "9.8" or "CVSS:3.1/AV:N/.../BaseScore: 9.8"
    const scoreMatch = vector.match(/cvss|score|base/i) || vector.includes('/');
    if (!scoreMatch) {
      const parsedNum = parseFloat(vector);
      if (!isNaN(parsedNum)) {
        score = parsedNum;
      }
    }
  }

  // If score is still null, look for database_specific.severity or advisory metadata
  if (score === null) {
    const dbSeverity = vuln.database_specific?.severity || vuln.database_specific?.cvss_severity;
    if (dbSeverity) {
      const sev = dbSeverity.toUpperCase();
      if (sev.includes('CRITICAL')) score = 9.5;
      else if (sev.includes('HIGH')) score = 8.0;
      else if (sev.includes('MEDIUM') || sev.includes('MODERATE')) score = 5.5;
      else if (sev.includes('LOW')) score = 2.5;
    }
  }

  // Final fallback to moderate if completely unknown
  if (score === null || isNaN(score)) {
    score = 5.0; // Default to medium severity if no scoring metadata is present
  }

  // Map score to standard level
  let level = 'Medium';
  if (score >= 9.0) level = 'Critical';
  else if (score >= 7.0) level = 'High';
  else if (score >= 4.0) level = 'Medium';
  else if (score > 0) level = 'Low';

  return { score: Math.round(score * 10) / 10, level };
}

/**
 * Extracts the recommended fixed version (if any) from the vulnerability record.
 */
/**
 * Loose version comparison: semver when both parse, otherwise numeric
 * segment-by-segment (good enough for PEP 440 release versions).
 */
function compareVersions(a, b) {
  const sa = semver.valid(semver.coerce(a, { loose: true }));
  const sb = semver.valid(semver.coerce(b, { loose: true }));
  if (semver.valid(a) && semver.valid(b)) return semver.compare(a, b);
  if (sa && sb && semver.compare(sa, sb) !== 0) return semver.compare(sa, sb);
  const pa = String(a).split(/[.\-+]/), pb = String(b).split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = parseInt(pa[i] ?? '0', 10), y = parseInt(pb[i] ?? '0', 10);
    if (!Number.isNaN(x) && !Number.isNaN(y) && x !== y) return x - y;
  }
  return 0;
}

/**
 * Finds the fix for the affected range that contains `version`.
 * OSV lists one range per release line (e.g. 0.x and 1.x), so taking the
 * last `fixed` event can point a 0.21 install at a 1.x release.
 */
function getFixedVersion(vuln, packageName, version) {
  const candidates = [];

  for (const affected of vuln.affected || []) {
    if (affected.package?.name?.toLowerCase() !== packageName.toLowerCase()) continue;
    for (const range of affected.ranges || []) {
      // GIT ranges use commit hashes, which aren't installable versions
      if (range.type === 'GIT') continue;
      let introduced = '0';
      for (const event of range.events || []) {
        if (event.introduced !== undefined) introduced = event.introduced;
        if (event.fixed) {
          candidates.push({ introduced, fixed: event.fixed });
          introduced = null;
        }
      }
    }
  }
  if (candidates.length === 0) return null;

  const inRange = candidates.find(c =>
    (c.introduced === '0' || c.introduced === null || compareVersions(version, c.introduced) >= 0) &&
    compareVersions(version, c.fixed) < 0
  );
  if (inRange) return inRange.fixed;

  // Otherwise the nearest fix above the installed version
  const above = candidates.map(c => c.fixed).filter(f => compareVersions(f, version) > 0).sort(compareVersions);
  return above[0] || null;
}

/**
 * Scans a list of resolved dependencies against the OSV database in batches.
 * Returns a detailed scan report.
 */
export async function scanDependencies(packages) {
  if (!packages || packages.length === 0) {
    return {
      vulnerabilities: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, unpatchedCritical: 0, clean: 0 }
    };
  }

  // Build the list of queries for OSV
  const queries = packages.map(pkg => ({
    package: {
      name: pkg.name,
      ecosystem: pkg.ecosystem
    },
    version: pkg.version
  }));

  const osvResults = [];
  // Chunk queries to limit size per request to 500
  const queryChunks = chunkArray(queries, 500);

  for (const chunk of queryChunks) {
    try {
      const response = await axios.post('https://api.osv.dev/v1/querybatch', { queries: chunk }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      if (response.data && response.data.results) {
        osvResults.push(...response.data.results);
      } else {
        // If empty results returned, fill with empty arrays for consistency
        osvResults.push(...chunk.map(() => ({})));
      }
    } catch (error) {
      console.error('Error querying OSV API batch:', error.message);
      // Fail-safe: treat this chunk as having no vulnerabilities instead of crashing the scan
      osvResults.push(...chunk.map(() => ({})));
    }
  }

  // querybatch only returns { id, modified } per advisory, so pull full records
  const uniqueIds = new Set();
  for (const result of osvResults) {
    for (const v of result?.vulns || []) uniqueIds.add(v.id);
  }
  const details = await fetchVulnDetails([...uniqueIds]);

  const vulnerabilities = [];
  const cleanPackages = new Set(packages.map(p => `${p.name}@${p.version}`));

  // Process OSV results
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const result = osvResults[i];

    if (result && result.vulns && Array.isArray(result.vulns)) {
      cleanPackages.delete(`${pkg.name}@${pkg.version}`);

      for (const stub of result.vulns) {
        const vuln = details.get(stub.id) || stub;
        const { score, level } = parseSeverity(vuln);
        const fixedVersion = getFixedVersion(vuln, pkg.name, pkg.version);
        const isUnpatched = !fixedVersion;

        // Extract identifier (prefer CVE, then GHSA, then OSV ID)
        let identifier = vuln.id;
        if (vuln.aliases && Array.isArray(vuln.aliases)) {
          const cve = vuln.aliases.find(alias => alias.startsWith('CVE-'));
          if (cve) identifier = cve;
        }

        vulnerabilities.push({
          id: vuln.id,
          identifier,
          packageName: pkg.name,
          version: pkg.version,
          ecosystem: pkg.ecosystem,
          summary: vuln.summary || vuln.details || 'No description available',
          details: vuln.details || '',
          score,
          severity: level,
          fixedVersion,
          remediation: isUnpatched 
            ? 'No patch currently available' 
            : `Upgrade to version ${fixedVersion} or higher`,
          references: vuln.references || [],
          aliases: vuln.aliases || [],
          published: vuln.published,
          modified: vuln.modified
        });
      }
    }
  }

  // Sort vulnerabilities: Critical -> High -> Medium -> Low (within levels, sort by score descending)
  const severityRank = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
  vulnerabilities.sort((a, b) => {
    const rankA = severityRank[a.severity] || 0;
    const rankB = severityRank[b.severity] || 0;
    if (rankB !== rankA) {
      return rankB - rankA;
    }
    return b.score - a.score;
  });

  // Calculate summary stats
  const summary = {
    total: vulnerabilities.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unpatchedCritical: 0,
    clean: cleanPackages.size,
    totalScanned: packages.length
  };

  for (const vuln of vulnerabilities) {
    const level = vuln.severity;
    if (level === 'Critical') {
      summary.critical++;
      if (!vuln.fixedVersion) {
        summary.unpatchedCritical++;
      }
    }
    else if (level === 'High') summary.high++;
    else if (level === 'Medium') summary.medium++;
    else if (level === 'Low') summary.low++;
  }

  return {
    vulnerabilities,
    summary
  };
}
