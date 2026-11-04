import type { Severity } from '../../types';
import { copyText } from '../../lib/toast';
import { IconCopy } from '../Icons';

export function SevPill({ severity, count }: { severity: Severity | 'Clean'; count?: number }) {
  return (
    <span className={`pill sev-${severity.toLowerCase()}`}>
      <span className="pill-dot" />
      {severity === 'Clean' ? 'Clear' : severity}
      {count !== undefined && count > 1 && <span className="pill-count">{count}</span>}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <span className="score" title={`CVSS ${score} of 10`}>
      <span className="score-num">{score.toFixed(1)}</span>
      <span className="score-track"><span style={{ width: `${score * 10}%` }} /></span>
    </span>
  );
}

export function CommandBox({ command, compact }: { command: string; compact?: boolean }) {
  return (
    <div className={`command ${compact ? 'command-compact' : ''}`}>
      <code><span className="command-prompt">$</span>{command}</code>
      <button className="icon-btn" aria-label="Copy command" onClick={() => copyText(command, 'Command copied')}>
        <IconCopy size={15} />
      </button>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {body && <p className="muted">{body}</p>}
    </div>
  );
}
