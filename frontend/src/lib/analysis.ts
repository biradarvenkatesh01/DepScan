import type { Dependency, ScanResult, ScanSummary, Severity, Vulnerability } from '../types';

export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

const RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export const severityRank = (s: string | null | undefined) => (s ? RANK[s] || 0 : 0);

export const pkgKey = (name: string, version: string) => `${name.toLowerCase()}@${version}`;

/** Loose version comparison that handles semver and most PEP 440 strings. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+_]/);
  const pb = b.split(/[.\-+_]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      return x.localeCompare(y);
    }
  }
  return 0;
}

export interface Grade {
  letter: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  note: string;
  tone: 'ok' | 'low' | 'medium' | 'high' | 'critical';
  /** 0–100, higher is healthier */
  score: number;
}

export function gradeFor(summary: ScanSummary): Grade {
  // Decays instead of hitting zero, so very noisy trees still rank against each other
  const penalty = summary.critical * 25 + summary.high * 10 + summary.medium * 4 + summary.low;
  const score = Math.round(100 * Math.exp(-penalty / 90));

  if (summary.unpatchedCritical > 0 || summary.critical >= 3) {
    return { letter: 'F', label: 'Critical risk', tone: 'critical', score,
      note: summary.unpatchedCritical > 0
        ? `${summary.unpatchedCritical} critical ${summary.unpatchedCritical === 1 ? 'advisory has' : 'advisories have'} no patch yet.`
        : 'Several critical advisories need attention now.' };
  }
  if (summary.critical > 0 || summary.high >= 5) {
    return { letter: 'D', label: 'High risk', tone: 'high', score,
      note: 'Critical or many high-severity issues. Upgrade soon.' };
  }
  if (summary.high > 0 || summary.medium >= 5) {
    return { letter: 'C', label: 'Elevated', tone: 'medium', score,
      note: 'A handful of meaningful issues worth scheduling.' };
  }
  if (summary.total > 0) {
    return { letter: 'B', label: 'Minor issues', tone: 'low', score,
      note: 'Only low or moderate advisories were found.' };
  }
  return { letter: 'A', label: 'All clear', tone: 'ok', score: 100,
    note: 'No known advisories in any scanned package.' };
}

export function groupByPackage(vulns: Vulnerability[]) {
  const map = new Map<string, Vulnerability[]>();
  for (const v of vulns) {
    const k = pkgKey(v.packageName, v.version);
    const list = map.get(k);
    if (list) list.push(v);
    else map.set(k, [v]);
  }
  return map;
}

export function worstSeverity(vulns: Vulnerability[] | undefined): Severity | null {
  if (!vulns || vulns.length === 0) return null;
  return vulns.reduce((w, v) => (severityRank(v.severity) > severityRank(w) ? v.severity : w), vulns[0].severity);
}

/** Follows `parent` links to show how a transitive package entered the tree. */
export function introducedVia(pkg: Dependency, packages: Dependency[]): string[] {
  const byName = new Map<string, Dependency>();
  for (const p of packages) if (!byName.has(p.name.toLowerCase())) byName.set(p.name.toLowerCase(), p);

  const path: string[] = [];
  let cursor = pkg.parent ? byName.get(pkg.parent.toLowerCase()) : undefined;
  const seen = new Set<string>([pkg.name.toLowerCase()]);
  while (cursor && !seen.has(cursor.name.toLowerCase()) && path.length < 8) {
    path.unshift(cursor.name);
    seen.add(cursor.name.toLowerCase());
    cursor = cursor.parent ? byName.get(cursor.parent.toLowerCase()) : undefined;
  }
  return path;
}

export interface FixItem {
  key: string;
  name: string;
  ecosystem: string;
  current: string;
  target: string;
  direct?: boolean;
  resolves: Vulnerability[];
  remaining: Vulnerability[];
  worst: Severity;
}

export interface FixPlan {
  items: FixItem[];
  unpatched: Array<{ key: string; name: string; version: string; ecosystem: string; vulns: Vulnerability[] }>;
  resolvable: number;
}

export function buildFixPlan(result: ScanResult): FixPlan {
  const groups = groupByPackage(result.vulnerabilities);
  const pkgByKey = new Map(result.packages.map(p => [pkgKey(p.name, p.version), p]));
  const items: FixItem[] = [];
  const unpatched: FixPlan['unpatched'] = [];

  for (const [key, vulns] of groups) {
    const fixable = vulns.filter(v => v.fixedVersion);
    const remaining = vulns.filter(v => !v.fixedVersion);
    const first = vulns[0];

    if (fixable.length > 0) {
      const target = fixable
        .map(v => v.fixedVersion as string)
        .reduce((max, v) => (compareVersions(v, max) > 0 ? v : max));
      items.push({
        key,
        name: first.packageName,
        ecosystem: first.ecosystem,
        current: first.version,
        target,
        direct: pkgByKey.get(key)?.direct,
        resolves: fixable,
        remaining,
        worst: worstSeverity(fixable) as Severity,
      });
    }
    if (remaining.length > 0) {
      unpatched.push({ key, name: first.packageName, version: first.version, ecosystem: first.ecosystem, vulns: remaining });
    }
  }

  items.sort((a, b) => severityRank(b.worst) - severityRank(a.worst) || b.resolves.length - a.resolves.length);
  unpatched.sort((a, b) => severityRank(worstSeverity(b.vulns)) - severityRank(worstSeverity(a.vulns)));

  return { items, unpatched, resolvable: items.reduce((n, i) => n + i.resolves.length, 0) };
}

export const isNpm = (ecosystem: string) => ecosystem.toLowerCase() === 'npm';

export function installCommand(items: Array<Pick<FixItem, 'name' | 'target' | 'ecosystem'>>): string[] {
  const npm = items.filter(i => isNpm(i.ecosystem));
  const pip = items.filter(i => !isNpm(i.ecosystem));
  const cmds: string[] = [];
  if (npm.length) cmds.push(`npm install ${npm.map(i => `${i.name}@${i.target}`).join(' ')}`);
  if (pip.length) cmds.push(`pip install --upgrade ${pip.map(i => `"${i.name}>=${i.target}"`).join(' ')}`);
  return cmds;
}

export const osvUrl = (id: string) => `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Exports ----------

export function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const baseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, '');

export function exportJson(result: ScanResult) {
  downloadBlob(JSON.stringify(result, null, 2), `depscan-${baseName(result.fileName)}.json`, 'application/json');
}

export function exportCsv(result: ScanResult) {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['identifier', 'osv_id', 'package', 'version', 'ecosystem', 'severity', 'cvss', 'fixed_version', 'published', 'summary'],
    ...result.vulnerabilities.map(v => [
      v.identifier, v.id, v.packageName, v.version, v.ecosystem, v.severity, v.score,
      v.fixedVersion ?? '', v.published ?? '', v.summary,
    ]),
  ];
  downloadBlob(rows.map(r => r.map(esc).join(',')).join('\n'), `depscan-${baseName(result.fileName)}.csv`, 'text/csv');
}

/** Recomputes summary counts, e.g. after ignored advisories are removed. */
export function summarize(vulns: Vulnerability[], packages: Dependency[]): ScanSummary {
  const affected = new Set(vulns.map(v => pkgKey(v.packageName, v.version)));
  const s: ScanSummary = {
    total: vulns.length, critical: 0, high: 0, medium: 0, low: 0, unpatchedCritical: 0,
    clean: packages.filter(p => !affected.has(pkgKey(p.name, p.version))).length,
    totalScanned: packages.length,
  };
  for (const v of vulns) {
    if (v.severity === 'Critical') {
      s.critical++;
      if (!v.fixedVersion) s.unpatchedCritical++;
    } else if (v.severity === 'High') s.high++;
    else if (v.severity === 'Medium') s.medium++;
    else if (v.severity === 'Low') s.low++;
  }
  return s;
}

const BADGE_COLORS: Record<Grade['tone'], string> = {
  ok: '248a3d', low: '4f6d8f', medium: 'a8780a', high: 'd9480f', critical: 'd70015',
};

export function badgeMarkdown(result: ScanResult): string {
  const g = gradeFor(result.summary);
  const n = result.summary.total;
  const text = n === 0 ? `${g.letter} · no known advisories` : `${g.letter} · ${n} ${n === 1 ? 'advisory' : 'advisories'}`;
  // shields.io static badges need dashes and underscores doubled
  const enc = (s: string) => encodeURIComponent(s.replace(/-/g, '--').replace(/_/g, '__'));
  return `![DepScan ${g.letter}](https://img.shields.io/badge/DepScan-${enc(text)}-${BADGE_COLORS[g.tone]})`;
}

export function markdownSummary(result: ScanResult): string {
  const g = gradeFor(result.summary);
  const s = result.summary;
  const lines = [
    `**DepScan · ${result.fileName}** — grade ${g.letter} (${g.label})`,
    `${s.totalScanned} packages scanned · ${s.total} advisories: ${s.critical} critical, ${s.high} high, ${s.medium} medium, ${s.low} low`,
  ];
  const top = result.vulnerabilities.slice(0, 5);
  if (top.length) {
    lines.push('', ...top.map(v => `- ${v.severity} · ${v.identifier} in ${v.packageName}@${v.version}${v.fixedVersion ? ` → fix ${v.fixedVersion}` : ' (no fix yet)'}`));
  }
  return lines.join('\n');
}
