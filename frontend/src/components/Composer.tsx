import { useRef, useState } from 'react';
import type React from 'react';
import type { ScanSource } from '../types';
import { fetchManifest, parseRepo } from '../lib/github';
import { IconArrowRight, IconFile, IconGithub, IconUpload } from './Icons';

type Mode = 'upload' | 'paste' | 'github' | 'package';

const VALID_NAMES = ['package.json', 'package-lock.json', 'requirements.txt'];

const SAMPLES = [
  {
    label: 'Express API',
    hint: 'lodash · axios · express',
    fileName: 'package.json',
    content: JSON.stringify({ name: 'express-api', dependencies: { express: '4.17.1', lodash: '4.17.20', axios: '0.21.1' } }, null, 2),
  },
  {
    label: 'React app',
    hint: 'react · axios',
    fileName: 'package.json',
    content: JSON.stringify({ name: 'react-app', dependencies: { react: '18.2.0', axios: '0.21.1' } }, null, 2),
  },
  {
    label: 'Flask service',
    hint: 'requests · jinja2 · flask',
    fileName: 'requirements.txt',
    content: 'flask==1.1.2\nrequests==2.25.0\njinja2==2.11.2\n',
  },
];

function detectFormat(text: string): { fileName: string } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Paste the contents of a manifest first.' };
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      return { fileName: data.lockfileVersion || data.packages ? 'package-lock.json' : 'package.json' };
    } catch {
      return { error: 'That looks like JSON but it doesn’t parse. Check for a trailing comma or a missing brace.' };
    }
  }
  return { fileName: 'requirements.txt' };
}

const toFile = (content: string, fileName: string) =>
  new File([content], fileName, { type: fileName.endsWith('.json') ? 'application/json' : 'text/plain' });

interface ComposerProps {
  onScan: (file: File, source: ScanSource) => void;
}

export default function Composer({ onScan }: ComposerProps) {
  const [mode, setMode] = useState<Mode>('upload');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [ecosystem, setEcosystem] = useState<'npm' | 'PyPI'>('npm');
  const [pkgName, setPkgName] = useState('');
  const [pkgVersion, setPkgVersion] = useState('');
  const [repo, setRepo] = useState('');
  const [fetching, setFetching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submitFile = (file: File) => {
    setError(null);
    if (!VALID_NAMES.includes(file.name.toLowerCase())) {
      setError(`“${file.name}” isn’t supported. Use package.json, package-lock.json or requirements.txt.`);
      return;
    }
    onScan(file, { kind: 'file', label: file.name });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFile(file);
  };

  const submitPaste = () => {
    const res = detectFormat(pasted);
    if ('error' in res) return setError(res.error);
    setError(null);
    onScan(toFile(pasted, res.fileName), { kind: 'paste', label: `Pasted ${res.fileName}` });
  };

  const submitRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = parseRepo(repo);
    if (!ref) return setError('Enter a repository as owner/name or paste its GitHub URL.');
    setError(null);
    setFetching(true);
    try {
      const { file, label, url } = await fetchManifest(ref);
      onScan(file, { kind: 'github', label, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t fetch that repository.');
    } finally {
      setFetching(false);
    }
  };

  const submitPackage = (e: React.FormEvent) => {
    e.preventDefault();
    const name = pkgName.trim();
    const version = pkgVersion.trim();
    if (!name) return setError('Enter a package name.');
    setError(null);
    if (ecosystem === 'npm') {
      onScan(toFile(JSON.stringify({ name: 'single-check', dependencies: { [name]: version || 'latest' } }), 'package.json'),
        { kind: 'package', label: `npm:${name}` });
    } else {
      onScan(toFile(version ? `${name}==${version}\n` : `${name}\n`, 'requirements.txt'), { kind: 'package', label: `PyPI:${name}` });
    }
  };

  const detected = pasted.trim() ? detectFormat(pasted) : null;

  return (
    <section className="composer card">
      <div className="composer-head">
        <div className="segmented" role="tablist" aria-label="Input method">
          {([
            ['upload', 'Upload'],
            ['paste', 'Paste'],
            ['github', 'GitHub'],
            ['package', 'Single package'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? 'is-active' : ''}
              onClick={() => { setMode(id); setError(null); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'upload' && (
        <div
          className={`dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".json,.txt"
            onChange={e => { const f = e.target.files?.[0]; if (f) submitFile(f); e.target.value = ''; }}
          />
          <div className="dropzone-icon"><IconUpload size={22} /></div>
          <div className="dropzone-title">{dragging ? 'Release to scan' : 'Drop a manifest here'}</div>
          <div className="dropzone-sub">or <span className="link-like">choose a file</span> from your computer</div>
          <div className="dropzone-formats">
            {VALID_NAMES.map(n => <span key={n} className="mono-chip">{n}</span>)}
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div className="paste">
          <textarea
            className="textarea"
            spellCheck={false}
            placeholder={'{\n  "dependencies": {\n    "lodash": "4.17.20"\n  }\n}\n\n— or —\n\nrequests==2.25.0'}
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            onKeyDown={e => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submitPaste()}
          />
          <div className="paste-foot">
            <span className="muted small">
              {detected && 'fileName' in detected
                ? <>Detected <span className="mono-chip">{detected.fileName}</span></>
                : 'Format is detected automatically'}
            </span>
            <button className="btn btn-primary" onClick={submitPaste}>
              Scan <span className="kbd-hint">Ctrl ↵</span>
            </button>
          </div>
        </div>
      )}

      {mode === 'github' && (
        <form className="single" onSubmit={submitRepo}>
          <div className="single-fields single-fields-repo">
            <label className="field">
              <span>Public repository</span>
              <span className="input-icon">
                <IconGithub size={16} />
                <input className="input" placeholder="owner/repo or a github.com link to a folder"
                  value={repo} onChange={e => setRepo(e.target.value)} autoComplete="off" spellCheck={false} />
              </span>
            </label>
            <button className="btn btn-primary single-submit" type="submit" disabled={fetching}>
              {fetching ? 'Fetching…' : <>Scan repo <IconArrowRight size={15} /></>}
            </button>
          </div>
          <p className="muted small">
            Looks for package-lock.json, then package.json, then requirements.txt. Link to a folder to scan a subproject.
          </p>
        </form>
      )}

      {mode === 'package' && (
        <form className="single" onSubmit={submitPackage}>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="Ecosystem">
            {(['npm', 'PyPI'] as const).map(e => (
              <button type="button" key={e} role="radio" aria-checked={ecosystem === e}
                className={ecosystem === e ? 'is-active' : ''} onClick={() => setEcosystem(e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="single-fields">
            <label className="field">
              <span>Package</span>
              <input className="input" placeholder={ecosystem === 'npm' ? 'lodash' : 'requests'}
                value={pkgName} onChange={e => setPkgName(e.target.value)} autoComplete="off" />
            </label>
            <label className="field field-version">
              <span>Version</span>
              <input className="input mono" placeholder="latest"
                value={pkgVersion} onChange={e => setPkgVersion(e.target.value)} autoComplete="off" />
            </label>
            <button className="btn btn-primary single-submit" type="submit">
              Check <IconArrowRight size={15} />
            </button>
          </div>
          <p className="muted small">Checks the package and everything it pulls in, up to three levels deep.</p>
        </form>
      )}

      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="samples">
        <span className="samples-label">Try a sample</span>
        {SAMPLES.map(s => (
          <button key={s.label} className="sample" onClick={() => onScan(toFile(s.content, s.fileName), { kind: 'sample', label: `Sample: ${s.label}` })}>
            <IconFile size={14} />
            <span className="sample-label">{s.label}</span>
            <span className="sample-hint">{s.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
