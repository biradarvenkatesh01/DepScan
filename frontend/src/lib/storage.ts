import type { IgnoreEntry, ScanResult } from '../types';

const HISTORY_KEY = 'depscan.history.v1';
const THEME_KEY = 'depscan.mode';
const MAX_HISTORY = 8;

export interface HistoryEntry {
  id: string;
  result: ScanResult;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadHistory = () => read<HistoryEntry[]>(HISTORY_KEY, []);

export function saveToHistory(result: ScanResult): HistoryEntry[] {
  const entry: HistoryEntry = { id: `${Date.now()}`, result };
  let next = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  // Big lockfiles can blow past the storage quota; keep fewer entries until it fits
  while (next.length > 0 && !write(HISTORY_KEY, next)) next = next.slice(0, next.length - 1);
  return next;
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter(e => e.id !== id);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory() {
  write(HISTORY_KEY, []);
}

// ---------- Ignored advisories ----------

const IGNORE_KEY = 'depscan.ignored.v1';

/** Keyed by advisory id + package name, so an ignore survives version bumps of the same package */
export const ignoreKey = (vulnId: string, packageName: string) => `${vulnId}|${packageName.toLowerCase()}`;

export const loadIgnored = () => read<Record<string, IgnoreEntry>>(IGNORE_KEY, {});

export function setIgnored(key: string, entry: IgnoreEntry | null): Record<string, IgnoreEntry> {
  const next = { ...loadIgnored() };
  if (entry) next[key] = entry;
  else delete next[key];
  write(IGNORE_KEY, next);
  return next;
}

export type ThemeId = 'light' | 'dark';

/** The saved mode, falling back to the system preference until the viewer picks one. */
export function loadTheme(): ThemeId {
  const saved = read<string | null>(THEME_KEY, null);
  if (saved === 'light' || saved === 'dark') return saved;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
export const saveTheme = (t: ThemeId) => write(THEME_KEY, t);
