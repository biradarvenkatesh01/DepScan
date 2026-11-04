import type { Dependency, ScanResult, Vulnerability } from '../types';
import type { HistoryEntry } from './storage';

/** Advisory identity across scans: the same advisory on the same package, any version. */
const vulnId = (v: Vulnerability) => `${v.id}|${v.packageName.toLowerCase()}`;
const depId = (d: Dependency) => d.name.toLowerCase();

export interface ScanDiff {
  previous: ScanResult;
  added: Vulnerability[];
  resolved: Vulnerability[];
  newPackages: Dependency[];
  removedPackages: Dependency[];
  upgraded: Array<{ name: string; from: string; to: string }>;
}

export const projectLabel = (r: ScanResult) => r.source?.label ?? r.fileName;

/** The most recent earlier scan of the same project, if any. */
export function findPrevious(current: ScanResult, history: HistoryEntry[]): ScanResult | null {
  const at = current.scannedAt;
  if (!at) return null;
  const label = projectLabel(current);
  const earlier = history
    .map(h => h.result)
    .filter(r => r.scannedAt && r.scannedAt < at && projectLabel(r) === label)
    .sort((a, b) => (b.scannedAt as string).localeCompare(a.scannedAt as string));
  return earlier[0] ?? null;
}

export function diffScans(previous: ScanResult, current: ScanResult): ScanDiff {
  const prevVulns = new Set(previous.vulnerabilities.map(vulnId));
  const currVulns = new Set(current.vulnerabilities.map(vulnId));
  const prevDeps = new Map(previous.packages.map(d => [depId(d), d]));
  const currDeps = new Map(current.packages.map(d => [depId(d), d]));

  const upgraded: ScanDiff['upgraded'] = [];
  for (const [id, d] of currDeps) {
    const before = prevDeps.get(id);
    if (before && before.version !== d.version) upgraded.push({ name: d.name, from: before.version, to: d.version });
  }

  return {
    previous,
    added: current.vulnerabilities.filter(v => !prevVulns.has(vulnId(v))),
    resolved: previous.vulnerabilities.filter(v => !currVulns.has(vulnId(v))),
    newPackages: current.packages.filter(d => !prevDeps.has(depId(d))),
    removedPackages: previous.packages.filter(d => !currDeps.has(depId(d))),
    upgraded,
  };
}
