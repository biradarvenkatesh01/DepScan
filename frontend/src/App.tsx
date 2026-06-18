import { useState } from 'react';
import axios from 'axios';
import Dropzone from './components/Dropzone';
import Dashboard from './components/Dashboard';
import ScanningTerminal from './components/ScanningTerminal';

interface ScanResult {
  fileName: string;
  packages: Array<{ name: string; version: string; ecosystem: string }>;
  vulnerabilities: Array<{
    id: string;
    identifier: string;
    packageName: string;
    version: string;
    ecosystem: string;
    summary: string;
    details: string;
    score: number;
    severity: string;
    fixedVersion: string | null;
    remediation: string;
    references: Array<{ url: string; label?: string }>;
    published?: string;
  }>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unpatchedCritical: number;
    clean: number;
    totalScanned: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [fileNameForLoader, setFileNameForLoader] = useState('');

  const handleFileSelected = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileNameForLoader(file.name);
    setLoadingStep('Parsing package declaration file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate steps to let the cyber terminal display logs beautifully
      setTimeout(() => setLoadingStep('Resolving transitive dependencies recursively...'), 900);
      setTimeout(() => setLoadingStep('Batch querying Google OSV database...'), 2000);

      const response = await axios.post(`${API_BASE_URL}/api/scan`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Ensure the scanner logs get displayed for at least a short duration before showing results
      setTimeout(() => {
        setScanResult(response.data);
        setIsLoading(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.error || 
        'Failed to connect to scanner service. Make sure the backend server is running.'
      );
      setIsLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!scanResult) return;
    setIsExporting(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/report`,
        {
          scanResult,
          fileName: scanResult.fileName,
        },
        {
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `depscan-report-${scanResult.fileName.replace(/\.[^/.]+$/, '')}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate and download PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
  };

  return (
    <div className="app-container">
      {/* Decorative cosmic background nebulae */}
      <div className="nebula-bg-1" />
      <div className="nebula-bg-2" />

      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">DS</div>
          <div className="logo-text">DepScan</div>
          <div className="logo-badge">v1.0</div>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500 }}>
          Google OSV.dev Integration
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div className="error-banner">
            <span>⚠️ <strong>Error:</strong> {error}</span>
            <button className="error-close" onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {isLoading ? (
          <ScanningTerminal fileName={fileNameForLoader} loadingStep={loadingStep} />
        ) : scanResult ? (
          <Dashboard 
            result={scanResult} 
            onReset={handleReset} 
            onExportPdf={handleExportPdf}
            isExporting={isExporting}
          />
        ) : (
          <div className="hero-panel">
            <div className="hero-content">
              <div className="hero-badges">
                <span>OSV API Coverage</span>
                <span>Transitive Resolution</span>
                <span>Remediation Copilot</span>
              </div>
              <h1 style={{ marginTop: '0.5rem' }}>
                Secure Your <span className="text-gradient-cyan-purple">Open-Source Code</span>
              </h1>
              <p>
                Upload your package manifest to resolve nested dependencies, query the Google OSV catalog, and generate rich security audit logs with instant fix suggestions.
              </p>
              <div className="hero-stats">
                <div>
                  <strong>100% Free</strong>
                  <span>Community OSV check</span>
                </div>
                <div>
                  <strong>JSON & PDF</strong>
                  <span>Audit report exports</span>
                </div>
              </div>
            </div>
            
            <Dropzone onFileSelected={handleFileSelected} isLoading={isLoading} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        marginTop: '3rem', 
        paddingTop: '1.5rem', 
        borderTop: '1px solid var(--glass-border)', 
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.78rem'
      }}>
        DepScan Dependency Tracker &copy; 2026. Powered by Google OSV Database API.
      </footer>
    </div>
  );
}
