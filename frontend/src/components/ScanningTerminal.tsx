import { useEffect, useState, useRef } from 'react';

interface ScanningTerminalProps {
  fileName: string;
  loadingStep: string;
}

export default function ScanningTerminal({ fileName, loadingStep }: ScanningTerminalProps) {
  const [logs, setLogs] = useState<Array<{ text: string; type: 'info' | 'success' | 'warning' | 'error' | 'system' }>>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Initial greeting logs
  useEffect(() => {
    setLogs([
      { text: `[SYSTEM] DEPSCAN SECURITY AUDIT v1.0 INITIALIZED`, type: 'system' },
      { text: `[SYSTEM] READY FOR DEPLOYMENT AUDIT`, type: 'system' },
      { text: `[INFO] target source file: ${fileName}`, type: 'info' },
      { text: `[INFO] connecting to google osv.dev security database...`, type: 'info' }
    ]);
  }, [fileName]);

  // Stream logs based on current loadingStep from App.tsx
  useEffect(() => {
    if (!loadingStep) return;

    const timestamp = () => new Date().toLocaleTimeString();
    
    if (loadingStep.includes('Parsing')) {
      setLogs(prev => [
        ...prev,
        { text: `[${timestamp()}] [PARSER] loading package declaration structure...`, type: 'info' },
        { text: `[${timestamp()}] [PARSER] file type resolved. initiating lexical token parse.`, type: 'info' },
        { text: `[${timestamp()}] [SUCCESS] package manifest parsed successfully.`, type: 'success' }
      ]);
    } 
    else if (loadingStep.includes('Resolving')) {
      setLogs(prev => [
        ...prev,
        { text: `[${timestamp()}] [RESOLVER] building dependency tree...`, type: 'info' },
        { text: `[${timestamp()}] [RESOLVER] fetching remote package metadata from registry...`, type: 'info' },
        { text: `[${timestamp()}] [RESOLVER] recursively resolving transitive packages (max_depth = 3)...`, type: 'info' },
        { text: `[${timestamp()}] [SUCCESS] resolved direct and indirect package declarations.`, type: 'success' }
      ]);
    } 
    else if (loadingStep.includes('Batch querying')) {
      setLogs(prev => [
        ...prev,
        { text: `[${timestamp()}] [SCANNER] batch querying OSV api endpoints...`, type: 'warning' },
        { text: `[${timestamp()}] [SCANNER] sending batch request for package ecosystem signatures.`, type: 'info' },
        { text: `[${timestamp()}] [SCANNER] cross-referencing packages with known CVE and GHSA mappings...`, type: 'info' }
      ]);
    }
  }, [loadingStep]);

  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="terminal-dots">
          <div className="terminal-dot red"></div>
          <div className="terminal-dot yellow"></div>
          <div className="terminal-dot green"></div>
        </div>
        <div className="terminal-title">DepScan Security Scanner Terminal</div>
        <div style={{ width: '42px' }}></div>
      </div>
      <div className="terminal-body">
        {logs.map((log, idx) => (
          <div key={idx} className={`terminal-line ${log.type}`}>
            {log.text}
          </div>
        ))}
        <div className="terminal-line info">
          [AUDIT STATE] SCANNING IN PROGRESS...<span className="terminal-cursor"></span>
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
