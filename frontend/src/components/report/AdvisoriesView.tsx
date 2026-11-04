import { useMemo, useState } from 'react';
import type { ScanResult, Severity, Vulnerability } from '../../types';
import { SEVERITIES, formatDate, pkgKey, severityRank } from '../../lib/analysis';
import { Empty, ScoreBar, SevPill } from './bits';
import { IconSearch } from '../Icons';
import { useSlashFocus } from './useSlashFocus';

type Sort = 'severity' | 'newest' | 'package';

interface Props {
  result: ScanResult;
  ignored: Vulnerability[];
  onOpen: (key: string, vulnId?: string) => void;
}

export default function AdvisoriesView({ result, ignored, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Set<Severity>>(new Set());
  const [fixableOnly, setFixableOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('severity');
  const [showIgnored, setShowIgnored] = useState(false);
  const searchRef = useSlashFocus<HTMLInputElement>();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of result.vulnerabilities) c[v.severity] = (c[v.severity] || 0) + 1;
    return c;
  }, [result.vulnerabilities]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ignoredIds = new Set(ignored);
    return (showIgnored ? [...result.vulnerabilities, ...ignored] : result.vulnerabilities)
      .map(v => ({ ...v, isIgnored: ignoredIds.has(v) }))
      .filter(v => (active.size === 0 || active.has(v.severity))
        && (!fixableOnly || v.fixedVersion)
        && (!q || [v.identifier, v.id, v.packageName, v.summary, ...(v.aliases || [])].some(s => s.toLowerCase().includes(q))))
      .sort((a, b) => {
        if (sort === 'newest') return (b.published || '').localeCompare(a.published || '');
        if (sort === 'package') return a.packageName.localeCompare(b.packageName);
        return severityRank(b.severity) - severityRank(a.severity) || b.score - a.score;
      });
  }, [result.vulnerabilities, ignored, showIgnored, query, active, fixableOnly, sort]);

  const toggle = (s: Severity) => setActive(prev => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    return next;
  });

  if (result.vulnerabilities.length === 0 && ignored.length === 0) {
    return <div className="card pad-lg"><Empty title="No advisories." body="Every scanned package is clear of known vulnerabilities." /></div>;
  }

  return (
    <section className="card card-flush">
      <div className="toolbar">
        <label className="search">
          <IconSearch size={15} />
          <input ref={searchRef} placeholder="Search CVE, GHSA, package or text" value={query} onChange={e => setQuery(e.target.value)} />
          <kbd>/</kbd>
        </label>
        <div className="chips">
          {SEVERITIES.filter(s => counts[s]).map(s => (
            <button key={s} className={`chip sev-${s.toLowerCase()} ${active.has(s) ? 'is-active' : ''}`} onClick={() => toggle(s)} aria-pressed={active.has(s)}>
              <span className="pill-dot" />{s} <span className="chip-count">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-end">
          {ignored.length > 0 && (
            <label className="toggle">
              <input type="checkbox" checked={showIgnored} onChange={e => setShowIgnored(e.target.checked)} />
              <span className="toggle-track" /> Ignored {ignored.length}
            </label>
          )}
          <label className="toggle">
            <input type="checkbox" checked={fixableOnly} onChange={e => setFixableOnly(e.target.checked)} />
            <span className="toggle-track" /> Has fix
          </label>
          <select className="select" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort advisories">
            <option value="severity">Sort by severity</option>
            <option value="newest">Newest first</option>
            <option value="package">Sort by package</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="No advisories match." body="Clear a filter to see more." />
      ) : (
        <ul className="rows rows-padded">
          {rows.map(v => (
            <li key={`${v.id}-${v.packageName}-${v.version}`}>
              <button className={`row ${v.isIgnored ? 'is-ignored' : ''}`} onClick={() => onOpen(pkgKey(v.packageName, v.version), v.id)}>
                <SevPill severity={v.severity} />
                <span className="row-main">
                  <span className="row-title">{v.summary}</span>
                  <span className="row-sub">
                    <span className="mono">{v.identifier}</span>
                    <span className="sep">·</span>
                    <span className="mono">{v.packageName}@{v.version}</span>
                    <span className="sep">·</span>
                    {v.fixedVersion ? <span>fixed in <span className="mono">{v.fixedVersion}</span></span> : <span className="text-warn">no fix yet</span>}
                    <span className="sep">·</span>
                    <span>{formatDate(v.published)}</span>
                    {v.isIgnored && <><span className="sep">·</span><span>ignored</span></>}
                  </span>
                </span>
                <ScoreBar score={v.score} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
