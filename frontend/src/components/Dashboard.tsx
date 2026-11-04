import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IgnoreEntry, ScanResult } from '../types';
import {
  SEVERITIES, badgeMarkdown, buildFixPlan, exportCsv, exportJson, gradeFor, groupByPackage, markdownSummary, pkgKey,
  summarize, timeAgo,
} from '../lib/analysis';
import { diffScans, findPrevious, projectLabel } from '../lib/diff';
import { ignoreKey, loadIgnored, setIgnored } from '../lib/storage';
import type { HistoryEntry } from '../lib/storage';
import { copyText, toast } from '../lib/toast';
import { IconArrowLeft, IconChevronDown, IconDownload, IconExternal } from './Icons';
import Overview from './report/Overview';
import PackagesView from './report/PackagesView';
import AdvisoriesView from './report/AdvisoriesView';
import FixPlanView from './report/FixPlanView';
import TreeView from './report/TreeView';
import PackageDrawer from './report/PackageDrawer';

type Tab = 'overview' | 'packages' | 'tree' | 'advisories' | 'fix';

interface DashboardProps {
  result: ScanResult;
  history: HistoryEntry[];
  onReset: () => void;
  onExportPdf: (result: ScanResult) => void;
  isExporting: boolean;
}

function ExportMenu({ result, onExportPdf, isExporting }: Pick<DashboardProps, 'result' | 'onExportPdf' | 'isExporting'>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => { fn(); setOpen(false); };

  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-primary" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu">
        <IconDownload size={15} /> {isExporting ? 'Preparing…' : 'Export'} <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" onClick={run(() => onExportPdf(result))} disabled={isExporting}>
            PDF report<span>Executive summary for sharing</span>
          </button>
          <button role="menuitem" onClick={run(() => exportJson(result))}>
            JSON<span>Full scan result, machine-readable</span>
          </button>
          <button role="menuitem" onClick={run(() => exportCsv(result))}>
            CSV<span>One advisory per row, for spreadsheets</span>
          </button>
          <div className="menu-sep" />
          <button role="menuitem" onClick={run(() => copyText(markdownSummary(result), 'Summary copied as Markdown'))}>
            Copy summary<span>Markdown, ready for a PR or Slack</span>
          </button>
          <button role="menuitem" onClick={run(() => copyText(badgeMarkdown(result), 'Badge copied — paste it into your README'))}>
            Copy README badge<span>Shields.io badge with the current grade</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ result: raw, history, onReset, onExportPdf, isExporting }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [selection, setSelection] = useState<{ key: string; vulnId?: string } | null>(null);
  const [ignored, setIgnoredState] = useState<Record<string, IgnoreEntry>>(loadIgnored);

  // Ignored advisories drop out of every count, grade and export
  const isIgnored = useCallback((v: { id: string; packageName: string }) => Boolean(ignored[ignoreKey(v.id, v.packageName)]), [ignored]);
  const result = useMemo<ScanResult>(() => {
    const vulnerabilities = raw.vulnerabilities.filter(v => !isIgnored(v));
    return { ...raw, vulnerabilities, summary: summarize(vulnerabilities, raw.packages) };
  }, [raw, isIgnored]);
  const ignoredVulns = useMemo(() => raw.vulnerabilities.filter(isIgnored), [raw, isIgnored]);

  const { summary, packages, vulnerabilities } = result;
  const grade = gradeFor(summary);
  const allGroups = useMemo(() => groupByPackage(raw.vulnerabilities), [raw.vulnerabilities]);
  const plan = useMemo(() => buildFixPlan(result), [result]);
  const previous = useMemo(() => findPrevious(raw, history), [raw, history]);
  const diff = useMemo(() => (previous ? diffScans(previous, raw) : null), [previous, raw]);

  const ecosystems = [...new Set(packages.map(p => p.ecosystem))].join(' + ');
  const vulnerable = summary.totalScanned - summary.clean;
  const unpatched = plan.unpatched.reduce((n, u) => n + u.vulns.length, 0);
  const title = projectLabel(raw);

  const open = useCallback((key: string, vulnId?: string) => setSelection({ key, vulnId }), []);
  const close = useCallback(() => setSelection(null), []);

  const onIgnore = useCallback((v: { id: string; identifier: string; packageName: string }, entry: IgnoreEntry | null) => {
    setIgnoredState(setIgnored(ignoreKey(v.id, v.packageName), entry));
    toast(entry ? `${v.identifier} ignored · ${entry.reason}` : `${v.identifier} restored`);
  }, []);

  const selectedPkg = selection ? packages.find(p => pkgKey(p.name, p.version) === selection.key) : undefined;
  const segments = SEVERITIES.map(s => ({ s, n: summary[s.toLowerCase() as 'critical'] as number })).filter(x => x.n > 0);
  const hasTree = packages.some(p => p.parent);

  const tabs: Array<[Tab, string, number?]> = [
    ['overview', 'Overview'],
    ['packages', 'Packages', packages.length],
    ...(hasTree ? [['tree', 'Tree'] as [Tab, string]] : []),
    ['advisories', 'Advisories', vulnerabilities.length],
    ['fix', 'Fix plan', plan.items.length],
  ];

  return (
    <div className="report fade-in">
      <header className="report-head">
        <div>
          <button className="btn-text back" onClick={onReset}><IconArrowLeft size={15} /> New scan</button>
          <h1 className="report-title">{title}</h1>
          <p className="muted">
            {title !== raw.fileName && <>{raw.fileName} · </>}
            {summary.totalScanned} packages{ecosystems && ` · ${ecosystems}`}{raw.scannedAt && ` · scanned ${timeAgo(raw.scannedAt)}`}
            {raw.source?.url && (
              <> · <a href={raw.source.url} target="_blank" rel="noopener noreferrer">GitHub <IconExternal size={12} /></a></>
            )}
          </p>
        </div>
        <ExportMenu result={result} onExportPdf={onExportPdf} isExporting={isExporting} />
      </header>

      <section className="summary card">
        <div className="summary-grade">
          <div className={`grade tone-${grade.tone}`}>
            <svg viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="35" className="grade-track" />
              <circle cx="40" cy="40" r="35" className="grade-arc"
                strokeDasharray={`${(grade.score / 100) * 219.9} 219.9`} />
            </svg>
            <span>{grade.letter}</span>
          </div>
          <div>
            <div className="summary-label">{grade.label}</div>
            <p className="muted small">{grade.note}</p>
            <p className="muted small">
              Health score {grade.score}/100
              {ignoredVulns.length > 0 && <> · {ignoredVulns.length} ignored</>}
            </p>
          </div>
        </div>

        <div className="summary-dist">
          <div className="summary-k">Severity</div>
          <div className="dist-bar" role="img" aria-label={`${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`}>
            {segments.length === 0
              ? <span className="fill-ok" style={{ flex: 1 }} />
              : segments.map(x => <span key={x.s} className={`fill-${x.s.toLowerCase()}`} style={{ flex: x.n }} />)}
          </div>
          <div className="dist-legend">
            {SEVERITIES.map(s => (
              <button key={s} className={`dist-item sev-${s.toLowerCase()}`} onClick={() => setTab('advisories')}>
                <span className="pill-dot" />
                <span className="dist-n">{summary[s.toLowerCase() as 'critical']}</span>
                <span className="muted small">{s}</span>
              </button>
            ))}
          </div>
        </div>

        <dl className="summary-stats">
          <div><dt>Vulnerable packages</dt><dd>{vulnerable}<span className="muted"> / {summary.totalScanned}</span></dd></div>
          <div><dt>Fixable by upgrade</dt><dd>{plan.resolvable}</dd></div>
          <div><dt>No patch yet</dt><dd className={unpatched ? 'text-warn' : ''}>{unpatched}</dd></div>
        </dl>
      </section>

      <nav className="tabs" role="tablist" aria-label="Report sections">
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            {label}{count !== undefined && <span className="tab-count">{count}</span>}
          </button>
        ))}
      </nav>

      <div key={tab} className="fade-in">
        {tab === 'overview' && <Overview result={result} diff={diff} onOpen={open} onShowAll={() => setTab('advisories')} />}
        {tab === 'packages' && <PackagesView result={result} onOpen={open} />}
        {tab === 'tree' && <TreeView result={result} onOpen={open} />}
        {tab === 'advisories' && <AdvisoriesView result={result} ignored={ignoredVulns} onOpen={open} />}
        {tab === 'fix' && <FixPlanView result={result} onOpen={open} />}
      </div>

      {selection && selectedPkg && (
        <PackageDrawer
          pkg={selectedPkg}
          vulns={allGroups.get(selection.key) || []}
          packages={packages}
          focusId={selection.vulnId}
          ignored={ignored}
          onIgnore={onIgnore}
          onClose={close}
        />
      )}
    </div>
  );
}
