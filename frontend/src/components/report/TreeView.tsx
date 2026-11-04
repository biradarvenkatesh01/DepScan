import { useMemo, useState } from 'react';
import type { Dependency, ScanResult, Vulnerability } from '../../types';
import { groupByPackage, pkgKey, worstSeverity } from '../../lib/analysis';
import { Empty, SevPill } from './bits';
import { IconChevron } from '../Icons';

const MAX_DEPTH = 10;

interface Node {
  pkg: Dependency;
  key: string;
  vulns: Vulnerability[];
  children: Node[];
  /** Vulnerable packages anywhere below this node */
  below: number;
}

function buildForest(result: ScanResult): { roots: Node[]; orphans: Node[] } {
  const groups = groupByPackage(result.vulnerabilities);
  const byParent = new Map<string, Dependency[]>();
  for (const p of result.packages) {
    if (!p.parent) continue;
    const k = p.parent.toLowerCase();
    const list = byParent.get(k);
    if (list) list.push(p);
    else byParent.set(k, [p]);
  }

  const build = (pkg: Dependency, seen: Set<string>, depth: number): Node => {
    const key = pkgKey(pkg.name, pkg.version);
    const vulns = groups.get(key) || [];
    const name = pkg.name.toLowerCase();
    const children = depth >= MAX_DEPTH || seen.has(name)
      ? []
      : (byParent.get(name) || [])
          .map(c => build(c, new Set(seen).add(name), depth + 1))
          .sort((a, b) => (b.below + (b.vulns.length ? 1 : 0)) - (a.below + (a.vulns.length ? 1 : 0)) || a.pkg.name.localeCompare(b.pkg.name));
    const below = children.reduce((n, c) => n + c.below + (c.vulns.length ? 1 : 0), 0);
    return { pkg, key, vulns, children, below };
  };

  const hasDirect = result.packages.some(p => p.direct);
  const top = result.packages.filter(p => (hasDirect ? p.direct : !p.parent));
  const orphans = hasDirect ? result.packages.filter(p => !p.direct && !p.parent) : [];
  const sortNodes = (nodes: Node[]) =>
    nodes.sort((a, b) => (b.below + (b.vulns.length ? 1 : 0)) - (a.below + (a.vulns.length ? 1 : 0)) || a.pkg.name.localeCompare(b.pkg.name));

  return {
    roots: sortNodes(top.map(p => build(p, new Set(), 0))),
    orphans: sortNodes(orphans.map(p => build(p, new Set(), 0))),
  };
}

const isRisky = (n: Node) => n.vulns.length > 0 || n.below > 0;

interface RowProps {
  node: Node;
  path: string;
  depth: number;
  expanded: Set<string>;
  riskyOnly: boolean;
  toggle: (path: string) => void;
  onOpen: (key: string) => void;
}

function TreeRow({ node, path, depth, expanded, riskyOnly, toggle, onOpen }: RowProps) {
  const kids = riskyOnly ? node.children.filter(isRisky) : node.children;
  const isOpen = expanded.has(path);
  const worst = worstSeverity(node.vulns);

  return (
    <li>
      <div className="tree-row" style={{ paddingLeft: 12 + depth * 22 }}>
        {kids.length > 0 ? (
          <button className={`tree-toggle ${isOpen ? 'is-open' : ''}`} onClick={() => toggle(path)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.pkg.name}`} aria-expanded={isOpen}>
            <IconChevron size={14} />
          </button>
        ) : (
          <span className="tree-leaf" />
        )}
        <button className="tree-name" onClick={() => onOpen(node.key)}>
          <span>{node.pkg.name}</span>
          <span className="mono muted small">{node.pkg.version}</span>
        </button>
        <span className="tree-meta">
          {node.below > 0 && <span className="muted small">{node.below} vulnerable below</span>}
          {worst && <SevPill severity={worst} count={node.vulns.length} />}
        </span>
      </div>
      {isOpen && kids.length > 0 && (
        <ul>
          {kids.map(c => (
            <TreeRow key={c.key} node={c} path={`${path}>${c.pkg.name}`} depth={depth + 1}
              expanded={expanded} riskyOnly={riskyOnly} toggle={toggle} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TreeView({ result, onOpen }: { result: ScanResult; onOpen: (key: string) => void }) {
  const { roots, orphans } = useMemo(() => buildForest(result), [result]);
  const hasRisk = result.vulnerabilities.length > 0;
  const [riskyOnly, setRiskyOnly] = useState(hasRisk);

  // Every path that leads to something vulnerable, for "Expand risky paths"
  const riskyPaths = useMemo(() => {
    const paths = new Set<string>();
    const walk = (n: Node, path: string) => {
      if (n.below > 0) paths.add(path);
      n.children.forEach(c => walk(c, `${path}>${c.pkg.name}`));
    };
    [...roots, ...orphans].forEach(r => walk(r, r.pkg.name));
    return paths;
  }, [roots, orphans]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(riskyPaths));

  const toggle = (path: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const shownRoots = riskyOnly ? roots.filter(isRisky) : roots;
  const shownOrphans = riskyOnly ? orphans.filter(isRisky) : orphans;

  return (
    <section className="card card-flush">
      <div className="toolbar">
        <div className="tree-legend muted small">
          {roots.length} direct · {result.packages.length - roots.length} transitive
        </div>
        <div className="toolbar-end">
          {hasRisk && (
            <label className="toggle">
              <input type="checkbox" checked={riskyOnly} onChange={e => setRiskyOnly(e.target.checked)} />
              <span className="toggle-track" /> Vulnerable paths only
            </label>
          )}
          <button className="btn-text" onClick={() => setExpanded(new Set(riskyPaths))}>Expand risky</button>
          <button className="btn-text" onClick={() => setExpanded(new Set())}>Collapse all</button>
        </div>
      </div>

      {shownRoots.length === 0 && shownOrphans.length === 0 ? (
        <Empty title="Nothing to show." body="No dependency paths lead to a vulnerable package." />
      ) : (
        <ul className="tree">
          {shownRoots.map(r => (
            <TreeRow key={r.key} node={r} path={r.pkg.name} depth={0}
              expanded={expanded} riskyOnly={riskyOnly} toggle={toggle} onOpen={onOpen} />
          ))}
          {shownOrphans.length > 0 && (
            <>
              <li className="tree-group label">Not linked to a direct dependency</li>
              {shownOrphans.map(r => (
                <TreeRow key={r.key} node={r} path={r.pkg.name} depth={0}
                  expanded={expanded} riskyOnly={riskyOnly} toggle={toggle} onOpen={onOpen} />
              ))}
            </>
          )}
        </ul>
      )}
    </section>
  );
}
