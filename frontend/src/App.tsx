import { useEffect, useState } from 'react';
import axios from 'axios';
import type { ScanResult, ScanSource } from './types';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import ScanProgress from './components/ScanProgress';
import Toaster from './components/Toast';
import { toast } from './lib/toast';
import { IconClose, IconGithub, IconMoon, IconSun, Logo } from './components/Icons';
import {
  clearHistory, loadHistory, loadTheme, removeFromHistory, saveTheme, saveToHistory,
} from './lib/storage';
import type { HistoryEntry, ThemeId } from './lib/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MIN_SCAN_MS = 900;
// Keep the original text for patching unless it would crowd out localStorage history
const MAX_MANIFEST_CHARS = 300_000;

type View = { kind: 'home' } | { kind: 'scanning'; fileName: string } | { kind: 'results'; result: ScanResult };

function ModeToggle({ theme, onChange }: { theme: ThemeId; onChange: (t: ThemeId) => void }) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Color mode">
      {([['light', 'Light mode', IconSun], ['dark', 'Dark mode', IconMoon]] as const).map(([id, label, Icon]) => (
        <button key={id} role="radio" aria-checked={theme === id} aria-label={label} title={label}
          className={theme === id ? 'is-active' : ''} onClick={() => onChange(id)}>
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [theme, setTheme] = useState<ThemeId>(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Only an explicit choice is saved, so the system preference applies until then
  const chooseTheme = (t: ThemeId) => {
    setTheme(t);
    saveTheme(t);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.kind]);

  const handleScan = async (file: File, source: ScanSource = { kind: 'file', label: file.name }) => {
    setError(null);
    setView({ kind: 'scanning', fileName: file.name });
    const started = performance.now();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<ScanResult>(`${API_BASE_URL}/api/scan`, formData);
      const wait = MIN_SCAN_MS - (performance.now() - started);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      const text = await file.text();
      const result: ScanResult = {
        ...response.data,
        scannedAt: new Date().toISOString(),
        source,
        manifest: text.length <= MAX_MANIFEST_CHARS ? text : undefined,
      };
      setHistory(saveToHistory(result));
      setView({ kind: 'results', result });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Couldn’t reach the scanner. Make sure the backend is running on ' + API_BASE_URL + '.';
      setError(message);
      setView({ kind: 'home' });
    }
  };

  // Receives the dashboard's view of the result, so ignored advisories stay out of the PDF
  const handleExportPdf = async (result: ScanResult) => {
    setIsExporting(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/report`,
        { scanResult: result, fileName: result.fileName },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `depscan-report-${result.fileName.replace(/\.[^/.]+$/, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('PDF report downloaded');
    } catch {
      toast('PDF export failed — is the backend running?');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app">
      <header className="nav">
        <div className="nav-inner">
          <button className="brand" onClick={() => setView({ kind: 'home' })} aria-label="DepScan home">
            <Logo />
            <span>DepScan</span>
          </button>
          <div className="nav-end">
            <ModeToggle theme={theme} onChange={chooseTheme} />
            <a className="icon-btn" href="https://github.com/biradarvenkatesh01/DepScan" target="_blank" rel="noopener noreferrer" aria-label="Source on GitHub">
              <IconGithub size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="banner" role="alert">
            <span>{error}</span>
            <button className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss"><IconClose size={15} /></button>
          </div>
        )}

        {view.kind === 'home' && (
          <Landing
            onScan={handleScan}
            history={history}
            onOpenHistory={entry => setView({ kind: 'results', result: entry.result })}
            onRemoveHistory={id => setHistory(removeFromHistory(id))}
            onClearHistory={() => { clearHistory(); setHistory([]); }}
          />
        )}
        {view.kind === 'scanning' && <ScanProgress fileName={view.fileName} />}
        {view.kind === 'results' && (
          <Dashboard
            result={view.result}
            history={history}
            onReset={() => setView({ kind: 'home' })}
            onExportPdf={handleExportPdf}
            isExporting={isExporting}
          />
        )}
      </main>

      <footer className="footer">
        <span>DepScan</span>
        <span className="muted">Advisory data from <a href="https://osv.dev" target="_blank" rel="noopener noreferrer">OSV.dev</a> · npm and PyPI registries</span>
      </footer>

      <Toaster />
    </div>
  );
}
