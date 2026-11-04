import { useMemo, useState } from 'react';
import type { ScanResult } from '../../types';
import { groupByPackage, pkgKey, severityRank, worstSeverity } from '../../lib/analysis';
import { Empty, SevPill } from './bits';
import { IconChevron, IconSearch } from '../Icons';
import { useSlashFocus } from './useSlashFocus';

type Filter = 'all' | 'vulnerable' | 'clean';
type Sort = 'risk' | 'name' | 'count';

const PAGE = 200;

export default function PackagesView({ result, onOpen }: { result: ScanResult; onOpen: (key: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('risk');
  const [directOnly, setDirectOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const searchRef = useSlashFocus<HTMLInputElement>();

  const groups = useMemo(() => groupByPackage(result.vulnerabilities), [result.vulnerabilities]);
  const hasDirectInfo = result.packages.some(p => p.direct);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return result.packages
      .map(p => {
        const key = pkgKey(p.name, p.version);
        const vulns = groups.get(key) || [];
        return { ...p, key, vulns, worst: worstSeverity(vulns) };
      })
      .filter(r => (!q || r.name.toLowerCase().includes(q))
        && (filter === 'all' || (filter === 'vulnerable' ? r.vulns.length > 0 : r.vulns.length === 0))
        && (!directOnly || r.direct))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'count') return b.vulns.length - a.vulns.length || a.name.localeCompare(b.name);
        return severityRank(b.worst) - severityRank(a.worst) || b.vulns.length - a.vulns.length || a.name.localeCompare(b.name);
      });
  }, [result.packages, groups, query, filter, sort, directOnly]);

  const vulnerableCount = result.packages.length - result.summary.clean;

  return (
    <section className="card card-flush">
      <div className="toolbar">
        <label className="search">
          <IconSearch size={15} />
          <input ref={searchRef} placeholder="Search packages" value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} />
          <kbd>/</kbd>
        </label>
        <div className="segmented segmented-sm">
          {([
            ['all', `All ${result.packages.length}`],
            ['vulnerable', `Vulnerable ${vulnerableCount}`],
            ['clean', `Clear ${result.summary.clean}`],
          ] as const).map(([id, label]) => (
            <button key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <div className="toolbar-end">
          {hasDirectInfo && (
            <label className="toggle">
              <input type="checkbox" checked={directOnly} onChange={e => setDirectOnly(e.target.checked)} />
              <span className="toggle-track" /> Direct only
            </label>
          )}
          <select className="select" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort packages">
            <option value="risk">Sort by risk</option>
            <option value="count">Sort by advisories</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="No packages match." body="Try a different search or filter." />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
                {hasDirectInfo && <th>Type</th>}
                <th>Ecosystem</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(r => (
                <tr key={r.key} onClick={() => onOpen(r.key)} tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onOpen(r.key)}>
                  <td>
                    <div className="cell-name">{r.name}</div>
                    {r.parent && <div className="cell-sub">via {r.parent}</div>}
                  </td>
                  <td className="mono">{r.version}</td>
                  {hasDirectInfo && <td><span className={`tag ${r.direct ? 'tag-strong' : ''}`}>{r.direct ? 'Direct' : 'Transitive'}</span></td>}
                  <td className="muted">{r.ecosystem}</td>
                  <td>{r.worst ? <SevPill severity={r.worst} count={r.vulns.length} /> : <SevPill severity="Clean" />}</td>
                  <td className="cell-end"><IconChevron size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div className="table-more">
          <button className="btn btn-secondary" onClick={() => setLimit(l => l + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more · {rows.length - limit} hidden
          </button>
        </div>
      )}
    </section>
  );
}
