export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
  direct?: boolean;
  parent?: string | null;
}

export interface Vulnerability {
  id: string;
  identifier: string;
  packageName: string;
  version: string;
  ecosystem: string;
  summary: string;
  details: string;
  score: number;
  severity: Severity;
  fixedVersion: string | null;
  remediation: string;
  references: Array<{ url: string; type?: string; label?: string }>;
  aliases?: string[];
  published?: string;
  modified?: string;
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unpatchedCritical: number;
  clean: number;
  totalScanned: number;
}

export interface ScanResult {
  fileName: string;
  packages: Dependency[];
  vulnerabilities: Vulnerability[];
  summary: ScanSummary;
  /** Added client-side when the scan completes */
  scannedAt?: string;
  /** Where the manifest came from; `label` identifies the project across scans */
  source?: ScanSource;
  /** Original manifest text, kept so a patched copy can be generated */
  manifest?: string;
}

export interface ScanSource {
  kind: 'file' | 'paste' | 'package' | 'github' | 'sample';
  label: string;
  url?: string;
}

export type IgnoreReason = 'Not reachable' | 'Dev only' | 'Accepted risk' | 'False positive';

export interface IgnoreEntry {
  reason: IgnoreReason;
  at: string;
}
