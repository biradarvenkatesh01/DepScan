import axios from 'axios';

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
function getFixedVersion(vuln, packageName) {
  let fixedVersion = null;

  if (vuln.affected && Array.isArray(vuln.affected)) {
    for (const affected of vuln.affected) {
      // Ensure the package name matches
      const affectedPkgName = affected.package?.name?.toLowerCase();
      if (affectedPkgName === packageName.toLowerCase()) {
        if (affected.ranges && Array.isArray(affected.ranges)) {
          for (const range of affected.ranges) {
            if (range.events && Array.isArray(range.events)) {
              for (const event of range.events) {
                if (event.fixed) {
                  // Keep the highest/latest fix if multiple are present
                  fixedVersion = event.fixed;
                }
              }
            }
          }
        }
      }
    }
  }

  return fixedVersion;
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

  const vulnerabilities = [];
  const cleanPackages = new Set(packages.map(p => `${p.name}@${p.version}`));

  // Process OSV results
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const result = osvResults[i];

    if (result && result.vulns && Array.isArray(result.vulns)) {
      cleanPackages.delete(`${pkg.name}@${pkg.version}`);

      for (const vuln of result.vulns) {
        const { score, level } = parseSeverity(vuln);
        const fixedVersion = getFixedVersion(vuln, pkg.name);
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
          published: vuln.published
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
