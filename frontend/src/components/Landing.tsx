import type { ScanSource } from '../types';
import { gradeFor, timeAgo } from '../lib/analysis';
import { projectLabel } from '../lib/diff';
import type { HistoryEntry } from '../lib/storage';
import Composer from './Composer';
import { IconChevron, IconTrash } from './Icons';

interface LandingProps {
  onScan: (file: File, source: ScanSource) => void;
  history: HistoryEntry[];
  onOpenHistory: (entry: HistoryEntry) => void;
  onRemoveHistory: (id: string) => void;
  onClearHistory: () => void;
}

export default function Landing({ onScan, history, onOpenHistory, onRemoveHistory, onClearHistory }: LandingProps) {
  return (
    <div className="landing fade-in">
      <section className="hero">
        <p className="eyebrow">Open-source dependency audit</p>
        <h1 className="display">
          Every dependency,<br />
          <span className="display-muted">accounted for.</span>
        </h1>
        <p className="lede">
          Drop in a manifest. DepScan resolves the full tree, checks every package against
          Google’s OSV database, and tells you exactly what to upgrade.
        </p>
      </section>

      <Composer onScan={onScan} />

      {history.length > 0 && (
        <section className="history">
          <div className="section-head">
            <h2 className="section-title">Recent scans</h2>
            <button className="btn-text" onClick={onClearHistory}>Clear all</button>
          </div>
          <ul className="history-list card">
            {history.map(entry => {
              const { result } = entry;
              const g = gradeFor(result.summary);
              return (
                <li key={entry.id} className="history-row">
                  <button className="history-main" onClick={() => onOpenHistory(entry)}>
                    <span className={`grade-chip tone-${g.tone}`}>{g.letter}</span>
                    <span className="history-name">
                      <span className="history-file">{projectLabel(result)}</span>
                      <span className="muted small">
                        {result.summary.totalScanned} packages · {result.summary.total} advisories · {timeAgo(result.scannedAt)}
                      </span>
                    </span>
                    <span className="history-sev">
                      {result.summary.critical > 0 && <span className="count-dot sev-critical">{result.summary.critical}</span>}
                      {result.summary.high > 0 && <span className="count-dot sev-high">{result.summary.high}</span>}
                      {result.summary.medium > 0 && <span className="count-dot sev-medium">{result.summary.medium}</span>}
                      {result.summary.low > 0 && <span className="count-dot sev-low">{result.summary.low}</span>}
                    </span>
                    <IconChevron size={16} className="muted" />
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${result.fileName} from history`} onClick={() => onRemoveHistory(entry.id)}>
                    <IconTrash size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted small history-note">Scans are kept only in this browser.</p>
        </section>
      )}

      <section className="facts">
        <div className="fact">
          <span className="fact-k">01</span>
          <h3>Full tree</h3>
          <p>Direct and transitive packages, resolved from npm and PyPI up to three levels deep.</p>
        </div>
        <div className="fact">
          <span className="fact-k">02</span>
          <h3>Real advisories</h3>
          <p>Each version is checked against OSV, which aggregates GitHub, PyPA and NVD advisories.</p>
        </div>
        <div className="fact">
          <span className="fact-k">03</span>
          <h3>A fix plan</h3>
          <p>One upgrade per package to the lowest version that clears every fixable advisory.</p>
        </div>
      </section>
    </div>
  );
}
