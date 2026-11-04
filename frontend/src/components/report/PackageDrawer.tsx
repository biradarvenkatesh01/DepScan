import { useEffect, useRef, useState } from 'react';
import type { Dependency, IgnoreEntry, IgnoreReason, Vulnerability } from '../../types';
import { ignoreKey } from '../../lib/storage';
import { formatDate, installCommand, introducedVia, osvUrl } from '../../lib/analysis';
import { CommandBox, ScoreBar, SevPill } from './bits';
import { IconChevron, IconClose, IconExternal, IconShield } from '../Icons';

interface Props {
  pkg: Dependency;
  vulns: Vulnerability[];
  packages: Dependency[];
  focusId?: string;
  ignored: Record<string, IgnoreEntry>;
  onIgnore: (v: Vulnerability, entry: IgnoreEntry | null) => void;
  onClose: () => void;
}

const REASONS: IgnoreReason[] = ['Not reachable', 'Dev only', 'Accepted risk', 'False positive'];

interface CardProps {
  v: Vulnerability;
  focused: boolean;
  ignore?: IgnoreEntry;
  onIgnore: (v: Vulnerability, entry: IgnoreEntry | null) => void;
}

function AdvisoryCard({ v, focused, ignore, onIgnore }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // OSV details are Markdown; drop the syntax rather than render it
  const details = v.details && v.details !== v.summary
    ? v.details.replace(/^#{1,6}\s*/gm, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
    : '';

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focused]);

  const aliases = (v.aliases || []).filter(a => a !== v.identifier);
  const refs = v.references.filter(r => r.url).slice(0, 4);

  return (
    <article ref={ref} className={`advisory ${focused ? 'is-focused' : ''} ${ignore ? 'is-ignored' : ''}`}>
      {ignore && (
        <div className="ignored-note">
          <span>Ignored · {ignore.reason} · {formatDate(ignore.at)}</span>
          <button className="btn-text" onClick={() => onIgnore(v, null)}>Restore</button>
        </div>
      )}
      <header className="advisory-head">
        <SevPill severity={v.severity} />
        <ScoreBar score={v.score} />
      </header>
      <h4 className="advisory-title">{v.summary}</h4>
      <div className="advisory-ids mono">
        <span>{v.identifier}</span>
        {aliases.slice(0, 2).map(a => <span key={a} className="muted">{a}</span>)}
      </div>

      {details && (
        <div className={`advisory-details ${expanded ? 'is-open' : ''}`}>
          <p>{details}</p>
          {details.length > 280 && (
            <button className="btn-text" onClick={() => setExpanded(x => !x)}>{expanded ? 'Show less' : 'Read more'}</button>
          )}
        </div>
      )}

      <dl className="kv kv-compact">
        <div><dt>Published</dt><dd>{formatDate(v.published)}</dd></div>
        <div><dt>Fixed in</dt><dd className="mono">{v.fixedVersion || <span className="text-warn">No patch yet</span>}</dd></div>
      </dl>

      {v.fixedVersion && <CommandBox compact command={installCommand([{ name: v.packageName, target: v.fixedVersion, ecosystem: v.ecosystem }])[0]} />}

      <div className="advisory-links">
        <a href={osvUrl(v.id)} target="_blank" rel="noopener noreferrer">View on OSV <IconExternal size={13} /></a>
        {refs.map(r => {
          let host = r.url;
          try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* keep raw url */ }
          return <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{host} <IconExternal size={13} /></a>;
        })}
      </div>

      {!ignore && (
        <div className="ignore-row">
          {choosing ? (
            <>
              <span className="muted small">Ignore because</span>
              {REASONS.map(r => (
                <button key={r} className="chip" onClick={() => { onIgnore(v, { reason: r, at: new Date().toISOString() }); setChoosing(false); }}>
                  {r}
                </button>
              ))}
              <button className="btn-text" onClick={() => setChoosing(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn-text btn-text-quiet" onClick={() => setChoosing(true)}>Ignore this advisory…</button>
          )}
        </div>
      )}
    </article>
  );
}

export default function PackageDrawer({ pkg, vulns, packages, focusId, ignored, onIgnore, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const path = introducedVia(pkg, packages);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`${pkg.name} details`}>
        <header className="sheet-head">
          <div>
            <p className="eyebrow">
              {pkg.ecosystem}
              {pkg.direct !== undefined && <> · {pkg.direct ? 'Direct' : 'Transitive'}</>}
            </p>
            <h3 className="sheet-title">{pkg.name}</h3>
            <p className="mono muted">{pkg.version}</p>
          </div>
          <button ref={closeRef} className="icon-btn icon-btn-lg" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </header>

        {path.length > 0 && (
          <div className="sheet-section">
            <div className="label">Introduced via</div>
            <div className="path">
              {path.map(p => <span key={p} className="path-node">{p}<IconChevron size={12} /></span>)}
              <span className="path-node is-current">{pkg.name}</span>
            </div>
          </div>
        )}

        <div className="sheet-section">
          <div className="label">{vulns.length ? `${vulns.length} ${vulns.length === 1 ? 'advisory' : 'advisories'}` : 'Status'}</div>
          {vulns.length === 0 ? (
            <div className="clear-state">
              <IconShield size={22} />
              <div>
                <strong>No known advisories</strong>
                <p className="muted small">OSV has no vulnerabilities recorded for {pkg.name}@{pkg.version}.</p>
              </div>
            </div>
          ) : (
            <div className="stack">
              {vulns.map(v => (
                <AdvisoryCard key={v.id} v={v} focused={v.id === focusId}
                  ignore={ignored[ignoreKey(v.id, v.packageName)]} onIgnore={onIgnore} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
