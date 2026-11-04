import { useMemo } from 'react';
import type { ScanResult } from '../../types';
import { groupByPackage, pkgKey, severityRank, worstSeverity } from '../../lib/analysis';
import { Empty, ScoreBar, SevPill } from './bits';
import { IconChevron } from '../Icons';
import type { ScanDiff } from '../../lib/diff';
import ChangesCard from './ChangesCard';

interface Props {
  result: ScanResult;
  diff: ScanDiff | null;
  onOpen: (key: string, vulnId?: string) => void;
  onShowAll: () => void;
}

export default function Overview({ result, diff, onOpen, onShowAll }: Props) {
  const { vulnerabilities, packages } = result;

  const exposed = useMemo(() => {
    const groups = groupByPackage(vulnerabilities);
    return [...groups.entries()]
      .map(([key, vulns]) => ({
        key,
        name: vulns[0].packageName,
        version: vulns[0].version,
        count: vulns.length,
        worst: worstSeverity(vulns)!,
        weight: vulns.reduce((n, v) => n + v.score, 0),
      }))
      .sort((a, b) => severityRank(b.worst) - severityRank(a.worst) || b.weight - a.weight)
      .slice(0, 6);
  }, [vulnerabilities]);

  const directCount = packages.filter(p => p.direct).length;
  const ecosystems = [...new Set(packages.map(p => p.ecosystem))];

  if (vulnerabilities.length === 0) {
    return (
      <div className="stack">
        {diff && <ChangesCard diff={diff} onOpen={onOpen} />}
        <div className="card pad-lg">
        <Empty
          title="Nothing to fix."
          body={`All ${packages.length} packages are clear of known advisories. Scan again after your next dependency bump.`}
        />
        </div>
      </div>
    );
  }

  const maxWeight = Math.max(...exposed.map(e => e.weight), 1);

  return (
    <div className="stack">
    {diff && <ChangesCard diff={diff} onOpen={onOpen} />}
    <div className="overview-grid">
      <section className="card">
        <div className="card-head">
          <h3>Needs attention</h3>
          <button className="btn-text" onClick={onShowAll}>All advisories <IconChevron size={14} /></button>
        </div>
        <ul className="rows">
          {vulnerabilities.slice(0, 6).map(v => (
            <li key={`${v.id}-${v.packageName}-${v.version}`}>
              <button className="row" onClick={() => onOpen(pkgKey(v.packageName, v.version), v.id)}>
                <SevPill severity={v.severity} />
                <span className="row-main">
                  <span className="row-title">{v.summary}</span>
                  <span className="row-sub mono">{v.identifier} · {v.packageName}@{v.version}</span>
                </span>
                <ScoreBar score={v.score} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h3>Most exposed packages</h3></div>
          <ul className="exposure">
            {exposed.map(e => (
              <li key={e.key}>
                <button className="exposure-row" onClick={() => onOpen(e.key)}>
                  <span className="exposure-name">
                    <span>{e.name}</span>
                    <span className="muted mono small">{e.version}</span>
                  </span>
                  <span className="exposure-track">
                    <span className={`fill-${e.worst.toLowerCase()}`} style={{ width: `${(e.weight / maxWeight) * 100}%` }} />
                  </span>
                  <span className="exposure-count">{e.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head"><h3>Composition</h3></div>
          <dl className="kv">
            <div><dt>Direct dependencies</dt><dd>{directCount || '—'}</dd></div>
            <div><dt>Transitive dependencies</dt><dd>{directCount ? packages.length - directCount : '—'}</dd></div>
            <div><dt>Ecosystems</dt><dd>{ecosystems.join(', ') || '—'}</dd></div>
            <div><dt>Advisories with a fix</dt><dd>{vulnerabilities.filter(v => v.fixedVersion).length} of {vulnerabilities.length}</dd></div>
          </dl>
        </section>
      </div>
    </div>
    </div>
  );
}
