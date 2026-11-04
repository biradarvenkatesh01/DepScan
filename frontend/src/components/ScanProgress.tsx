import { useEffect, useState } from 'react';
import { IconCheck } from './Icons';

const STEPS = [
  { label: 'Reading manifest', at: 0 },
  { label: 'Resolving transitive dependencies', at: 700 },
  { label: 'Checking advisories on OSV', at: 2600 },
  { label: 'Building your report', at: 5200 },
];

export default function ScanProgress({ fileName }: { fileName: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), 120);
    return () => window.clearInterval(id);
  }, []);

  const active = STEPS.reduce((idx, s, i) => (elapsed >= s.at ? i : idx), 0);
  // Eases toward 92% so the bar never claims to be done before the server is
  const progress = Math.min(92, 92 * (1 - Math.exp(-elapsed / 3500)));

  return (
    <div className="progress-wrap fade-in">
      <div className="progress card">
        <p className="eyebrow">Scanning</p>
        <h2 className="progress-title">{fileName}</h2>
        <div className="bar" aria-hidden><span style={{ width: `${progress}%` }} /></div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.label} className={i < active ? 'is-done' : i === active ? 'is-active' : ''}>
              <span className="step-mark">{i < active ? <IconCheck size={12} /> : null}</span>
              {s.label}
            </li>
          ))}
        </ol>
        <p className="muted small">
          {(elapsed / 1000).toFixed(1)}s · large manifests can take up to a minute while registries respond.
        </p>
      </div>
    </div>
  );
}
