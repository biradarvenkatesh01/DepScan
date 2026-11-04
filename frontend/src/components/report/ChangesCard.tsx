import type { ScanDiff } from '../../lib/diff';
import { pkgKey, timeAgo } from '../../lib/analysis';
import { SevPill } from './bits';

interface Props {
  diff: ScanDiff;
  onOpen: (key: string, vulnId?: string) => void;
}

export default function ChangesCard({ diff, onOpen }: Props) {
  const { added, resolved, newPackages, removedPackages, upgraded, previous } = diff;
  const nothing = !added.length && !resolved.length && !newPackages.length && !removedPackages.length && !upgraded.length;

  return (
    <section className="card changes">
      <div className="card-head">
        <h3>Since last scan</h3>
        <span className="muted small">compared with {timeAgo(previous.scannedAt)}</span>
      </div>

      {nothing ? (
        <p className="muted">No changes: same packages, same advisories.</p>
      ) : (
        <>
          <div className="changes-stats">
            <div className={added.length ? 'is-bad' : ''}><strong>+{added.length}</strong><span>new advisories</span></div>
            <div className={resolved.length ? 'is-good' : ''}><strong>−{resolved.length}</strong><span>resolved</span></div>
            <div><strong>{upgraded.length}</strong><span>version changes</span></div>
            <div><strong>{newPackages.length}/{removedPackages.length}</strong><span>packages added / removed</span></div>
          </div>

          {(added.length > 0 || resolved.length > 0) && (
            <div className="changes-lists">
              {added.length > 0 && (
                <ul>
                  <li className="label">New</li>
                  {added.slice(0, 4).map(v => (
                    <li key={`${v.id}-${v.packageName}`}>
                      <button className="changes-row" onClick={() => onOpen(pkgKey(v.packageName, v.version), v.id)}>
                        <SevPill severity={v.severity} />
                        <span className="mono small">{v.identifier}</span>
                        <span className="muted small">{v.packageName}</span>
                      </button>
                    </li>
                  ))}
                  {added.length > 4 && <li className="muted small">+{added.length - 4} more</li>}
                </ul>
              )}
              {resolved.length > 0 && (
                <ul>
                  <li className="label">Resolved</li>
                  {resolved.slice(0, 4).map(v => (
                    <li key={`${v.id}-${v.packageName}`} className="changes-row changes-row-static">
                      <SevPill severity={v.severity} />
                      <span className="mono small strike">{v.identifier}</span>
                      <span className="muted small">{v.packageName}</span>
                    </li>
                  ))}
                  {resolved.length > 4 && <li className="muted small">+{resolved.length - 4} more</li>}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
