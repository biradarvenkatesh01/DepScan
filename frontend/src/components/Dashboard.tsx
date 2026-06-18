import { useState } from 'react';

export interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
}

export interface Vulnerability {
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
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unpatchedCritical: number;
  clean: number;
  totalScanned: number;
}

export interface ScanResult {
  fileName: string;
  packages: Dependency[];
  vulnerabilities: Vulnerability[];
  summary: ScanSummary;
}

interface DashboardProps {
  result: ScanResult;
  onReset: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
}

type TabType = 'overview' | 'tree' | 'actions';

export default function Dashboard({ result, onReset, onExportPdf, isExporting }: DashboardProps) {
  const { fileName, packages, vulnerabilities, summary } = result;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group vulnerabilities by package name for quick access inside expanded drawer and visual trees
  const vulnsByPackage = vulnerabilities.reduce((acc, vuln) => {
    const key = vuln.packageName.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(vuln);
    return acc;
  }, {} as Record<string, Vulnerability[]>);

  // Map package name to its highest vulnerability severity
  const pkgMaxSeverity = packages.reduce((acc, pkg) => {
    const key = pkg.name.toLowerCase();
    const pkgVulns = vulnsByPackage[key] || [];
    if (pkgVulns.length === 0) {
      acc[key] = 'Clean';
    } else {
      const severityOrder: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      let maxSev = 'Low';
      let maxRank = 0;
      for (const v of pkgVulns) {
        const rank = severityOrder[v.severity] || 0;
        if (rank > maxRank) {
          maxRank = rank;
          maxSev = v.severity;
        }
      }
      acc[key] = maxSev;
    }
    return acc;
  }, {} as Record<string, string>);

  // Filter packages based on search and selected severity filter
  const filteredPackages = packages.filter(pkg => {
    const nameMatch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
    const severity = pkgMaxSeverity[pkg.name.toLowerCase()];
    
    if (severityFilter === 'All') return nameMatch;
    if (severityFilter === 'Vulnerable') return nameMatch && severity !== 'Clean';
    return nameMatch && severity === severityFilter;
  });

  // SVG Donut Chart Calculation
  const radius = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  
  const chartSegments = [
    { label: 'Critical', value: summary.critical, color: 'var(--sev-critical)' },
    { label: 'High', value: summary.high, color: 'var(--sev-high)' },
    { label: 'Medium', value: summary.medium, color: 'var(--sev-medium)' },
    { label: 'Low', value: summary.low, color: 'var(--sev-low)' },
    { label: 'Clean', value: summary.clean, color: 'var(--sev-clean)' }
  ].filter(s => s.value > 0);

  const totalSegmentValues = chartSegments.reduce((sum, s) => sum + s.value, 0);
  let currentOffset = 0;

  // Clipboard copy handler for Action Center commands
  const handleCopyCommand = (command: string, uniqueId: string) => {
    navigator.clipboard.writeText(command);
    setCopiedId(uniqueId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get selected package details for side drawer
  const getSelectedPackageDetails = () => {
    if (!selectedPackage) return null;
    const pkg = packages.find(p => p.name.toLowerCase() === selectedPackage.toLowerCase());
    const pkgVulns = vulnsByPackage[selectedPackage.toLowerCase()] || [];
    return { pkg, pkgVulns };
  };

  const drawerDetails = getSelectedPackageDetails();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dashboard Sticky Controls Card */}
      <div className="glass-card flex-between" style={{ padding: '1.25rem 1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Audit Workspace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Target Manifest:</span>
            <code style={{ color: 'var(--accent-cyan)' }}>{fileName}</code>
            <span>•</span>
            <span>{packages.length} packages scanned</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onReset}>
            Upload New Manifest
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onExportPdf} 
            disabled={isExporting}
          >
            {isExporting ? 'Generating Report...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metric-grid">
        <div className="metric-card critical">
          <span className="metric-label">Critical</span>
          <span className="metric-value">{summary.critical}</span>
          <span className="metric-desc">
            {summary.unpatchedCritical > 0 ? `${summary.unpatchedCritical} Unpatched Fixes` : '0 Unpatched Fixes'}
          </span>
        </div>
        <div className="metric-card high">
          <span className="metric-label">High</span>
          <span className="metric-value">{summary.high}</span>
          <span className="metric-desc">High risk CVEs</span>
        </div>
        <div className="metric-card medium">
          <span className="metric-label">Medium</span>
          <span className="metric-value">{summary.medium}</span>
          <span className="metric-desc">Moderate risk CVEs</span>
        </div>
        <div className="metric-card low">
          <span className="metric-label">Low</span>
          <span className="metric-value">{summary.low}</span>
          <span className="metric-desc">Minor risk CVEs</span>
        </div>
        <div className="metric-card clean">
          <span className="metric-label">Clean Libraries</span>
          <span className="metric-value">{summary.clean}</span>
          <span className="metric-desc">Security check passed</span>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="tab-navbar">
        <button 
          className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          🛡️ Overview
        </button>
        <button 
          className={`tab-link ${activeTab === 'tree' ? 'active' : ''}`}
          onClick={() => setActiveTab('tree')}
        >
          🌳 Dependency Map
        </button>
        <button 
          className={`tab-link ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          ⚡ Action Center ({vulnerabilities.filter(v => v.fixedVersion).length})
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="dashboard-grid">
          
          {/* Donut Chart visualizer */}
          <div className="glass-card chart-container" style={{ alignSelf: 'start' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '1.25rem', width: '100%', textAlign: 'center', fontFamily: 'var(--font-heading)' }}>Severity Proportion</h3>
            
            <svg className="donut-svg">
              <circle 
                className="donut-circle-bg" 
                cx="80" 
                cy="80" 
                r={radius}
                strokeWidth={strokeWidth}
              />
              {totalSegmentValues > 0 ? (
                chartSegments.map((seg, idx) => {
                  const percentage = seg.value / totalSegmentValues;
                  const strokeDash = percentage * circumference;
                  const strokeOffset = currentOffset;
                  currentOffset -= strokeDash;

                  return (
                    <circle
                      key={idx}
                      className="donut-segment"
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      strokeDashoffset={strokeOffset}
                    />
                  );
                })
              ) : (
                <circle
                  className="donut-segment"
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="var(--sev-clean)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset="0"
                />
              )}
              
              <g transform="translate(80, 80) rotate(90)">
                <text className="donut-text" y="-2" fontSize="16">
                  {summary.total}
                </text>
                <text className="donut-text-sub" y="14">
                  CVE Detections
                </text>
              </g>
            </svg>

            {/* Interactive Legend List */}
            <div className="legend-list">
              <div className="legend-item" style={{ cursor: 'pointer' }} onClick={() => setSeverityFilter(severityFilter === 'Critical' ? 'All' : 'Critical')}>
                <span><span className="legend-color-tag" style={{ background: 'var(--sev-critical)' }} />Critical</span>
                <span style={{ fontWeight: 600, color: severityFilter === 'Critical' ? 'var(--accent-cyan)' : '#fff' }}>{summary.critical}</span>
              </div>
              <div className="legend-item" style={{ cursor: 'pointer' }} onClick={() => setSeverityFilter(severityFilter === 'High' ? 'All' : 'High')}>
                <span><span className="legend-color-tag" style={{ background: 'var(--sev-high)' }} />High</span>
                <span style={{ fontWeight: 600, color: severityFilter === 'High' ? 'var(--accent-cyan)' : '#fff' }}>{summary.high}</span>
              </div>
              <div className="legend-item" style={{ cursor: 'pointer' }} onClick={() => setSeverityFilter(severityFilter === 'Medium' ? 'All' : 'Medium')}>
                <span><span className="legend-color-tag" style={{ background: 'var(--sev-medium)' }} />Medium</span>
                <span style={{ fontWeight: 600, color: severityFilter === 'Medium' ? 'var(--accent-cyan)' : '#fff' }}>{summary.medium}</span>
              </div>
              <div className="legend-item" style={{ cursor: 'pointer' }} onClick={() => setSeverityFilter(severityFilter === 'Low' ? 'All' : 'Low')}>
                <span><span className="legend-color-tag" style={{ background: 'var(--sev-low)' }} />Low</span>
                <span style={{ fontWeight: 600, color: severityFilter === 'Low' ? 'var(--accent-cyan)' : '#fff' }}>{summary.low}</span>
              </div>
              <div className="legend-item" style={{ cursor: 'pointer' }} onClick={() => setSeverityFilter(severityFilter === 'Clean' ? 'All' : 'Clean')}>
                <span><span className="legend-color-tag" style={{ background: 'var(--sev-clean)' }} />Clean</span>
                <span style={{ fontWeight: 600, color: severityFilter === 'Clean' ? 'var(--accent-cyan)' : '#fff' }}>{summary.clean}</span>
              </div>
            </div>
          </div>

          {/* Dependencies Table Grid */}
          <div className="glass-card">
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Filter libraries..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <button 
                  className={`filter-btn ${severityFilter === 'All' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('All')}
                >
                  All ({packages.length})
                </button>
                <button 
                  className={`filter-btn ${severityFilter === 'Vulnerable' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('Vulnerable')}
                >
                  Vulnerable ({summary.totalScanned - summary.clean})
                </button>
                <button 
                  className={`filter-btn ${severityFilter === 'Clean' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('Clean')}
                >
                  Clean ({summary.clean})
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="scan-table">
                <thead>
                  <tr>
                    <th>Package Name</th>
                    <th>Current Version</th>
                    <th>Ecosystem Signature</th>
                    <th>Security Severity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackages.length > 0 ? (
                    filteredPackages.map((pkg, idx) => {
                      const key = pkg.name.toLowerCase();
                      const maxSev = pkgMaxSeverity[key];
                      const pkgVulns = vulnsByPackage[key] || [];
                      const isVulnerable = maxSev !== 'Clean';

                      return (
                        <tr 
                          key={idx}
                          className={isVulnerable ? 'vulnerable-row' : ''}
                        >
                          <td style={{ fontWeight: 600 }}>{pkg.name}</td>
                          <td><code>{pkg.version}</code></td>
                          <td>
                            <span className="ecosystem-badge">{pkg.ecosystem}</span>
                          </td>
                          <td>
                            {maxSev === 'Clean' ? (
                              <span className="badge badge-clean">Clean</span>
                            ) : (
                              <span className={`badge badge-${maxSev.toLowerCase()}`}>
                                {maxSev} ({pkgVulns.length})
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isVulnerable ? (
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                onClick={() => setSelectedPackage(key)}
                              >
                                Inspect CVEs
                              </button>
                            ) : (
                              <span style={{ color: 'var(--sev-clean)', fontWeight: 600, fontSize: '0.9rem' }}>✓ Secured</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                        No package declarations found matching the filter matrix.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 2: DEPENDENCY MAP VISUALIZER */}
      {activeTab === 'tree' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Interactive Dependency Tree Map</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            A visual hierarchical layout mapping analyzed libraries and nesting any detected CVE advisories.
          </p>
          
          <div className="dependency-map-container">
            {packages.map((pkg, idx) => {
              const key = pkg.name.toLowerCase();
              const pkgVulns = vulnsByPackage[key] || [];
              const isVulnerable = pkgVulns.length > 0;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  
                  {/* Primary Package Node */}
                  <div className={`tree-node-wrapper tree-level-indent-0 ${isVulnerable ? 'vulnerable' : ''}`}>
                    <div className="tree-node-left">
                      <span className="tree-node-arrow">📦</span>
                      <div className="tree-node-info">
                        <span className="tree-node-name">{pkg.name}</span>
                        <div className="tree-node-version-row">
                          <span>Version: <code>{pkg.version}</code></span>
                          <span>•</span>
                          <span className="ecosystem-badge" style={{ fontSize: '0.65rem' }}>{pkg.ecosystem}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {isVulnerable ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px' }}
                          onClick={() => setSelectedPackage(key)}
                        >
                          Show {pkgVulns.length} Alerts
                        </button>
                      ) : (
                        <span style={{ color: 'var(--sev-clean)', fontSize: '0.78rem', fontWeight: 600 }}>Clean</span>
                      )}
                    </div>
                  </div>

                  {/* Vulnerability Child Nodes */}
                  {isVulnerable && pkgVulns.map((vuln, vIdx) => (
                    <div 
                      key={vIdx} 
                      className="tree-node-wrapper tree-level-indent-1 vulnerable"
                      style={{ cursor: 'pointer', padding: '0.55rem 0.85rem' }}
                      onClick={() => setSelectedPackage(key)}
                    >
                      <div className="tree-node-left">
                        <span className="tree-node-arrow" style={{ color: 'var(--sev-critical)' }}>↳ 🔴</span>
                        <div className="tree-node-info">
                          <span className="tree-node-name" style={{ color: '#fff', fontSize: '0.85rem' }}>{vuln.identifier}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CVSS Score: {vuln.score} • {vuln.severity}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                        View Details
                      </div>
                    </div>
                  ))}

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: ACTION REMEDIATION CENTER */}
      {activeTab === 'actions' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Security Action Center</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Consolidated terminal shortcuts to execute upgrades and remediate identified vulnerabilities.
          </p>

          <div className="action-timeline">
            {vulnerabilities.filter(v => v.fixedVersion).length > 0 ? (
              vulnerabilities
                .filter(v => v.fixedVersion)
                .map((vuln, idx) => {
                  const sevLower = vuln.severity.toLowerCase();
                  
                  // Construct package manager specific CLI commands
                  const command = vuln.ecosystem.toLowerCase() === 'npm'
                    ? `npm install ${vuln.packageName}@${vuln.fixedVersion}`
                    : `pip install --upgrade ${vuln.packageName}==${vuln.fixedVersion}`;

                  const uniqueKey = `${vuln.id}-${idx}`;

                  return (
                    <div key={idx} className={`action-card ${sevLower}`}>
                      <div className="action-card-header">
                        <h4 className="action-card-title">
                          Remediation Target: <span className="text-gradient-cyan-purple">{vuln.packageName}</span>
                        </h4>
                        <span className={`badge badge-${sevLower}`} style={{ fontSize: '0.68rem' }}>
                          {vuln.severity} CVE (CVSS {vuln.score})
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Current version: <code>{vuln.version}</code> → Recommended version: <code style={{ color: 'var(--accent-neon)' }}>{vuln.fixedVersion}</code>
                      </div>

                      <div className="action-terminal-box">
                        <span>$ {command}</span>
                        <button 
                          className="copy-btn"
                          onClick={() => handleCopyCommand(command, uniqueKey)}
                        >
                          {copiedId === uniqueKey ? 'Copied! ✓' : 'Copy CLI'}
                        </button>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No automated remediation commands generated. All packages are clean or currently lack vendor-supplied patches.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLIDE-OUT DRAWER PANEL FOR CVE DETAILS */}
      {selectedPackage && drawerDetails && (
        <>
          {/* Backdrop layer */}
          <div className="drawer-overlay" onClick={() => setSelectedPackage(null)} />
          
          {/* Drawer content layout */}
          <div className="drawer-content">
            <div className="drawer-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.05em', fontWeight: 600 }}>Library Scan Audit</span>
                <h3 className="drawer-title">{drawerDetails.pkg?.name}</h3>
              </div>
              <button className="drawer-close" onClick={() => setSelectedPackage(null)}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Package Summary Metadata */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Current Manifest Version</div>
                  <code style={{ fontSize: '0.9rem' }}>{drawerDetails.pkg?.version}</code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Package Ecosystem</div>
                  <span className="ecosystem-badge">{drawerDetails.pkg?.ecosystem}</span>
                </div>
              </div>

              {/* Header section detailing alerts count */}
              <h4 style={{ margin: '0.5rem 0 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                Active Security Advisories ({drawerDetails.pkgVulns.length})
              </h4>

              {/* Vulnerabilities loop */}
              {drawerDetails.pkgVulns.map((vuln, idx) => {
                const sevLower = vuln.severity.toLowerCase();
                return (
                  <div key={idx} className={`drawer-vuln-card ${sevLower}`}>
                    <div className="drawer-vuln-meta">
                      <span className="badge badge-critical" style={{ color: '#fff', fontSize: '0.7rem', border: 'none', background: 'var(--sev-' + sevLower + ')' }}>
                        {vuln.identifier}
                      </span>
                      <span className="drawer-vuln-score-pill">
                        CVSS {vuln.score}
                      </span>
                    </div>

                    <p className="drawer-vuln-desc">{vuln.summary}</p>

                    {/* Remediation Details */}
                    <div className="drawer-vuln-remediation">
                      <div className="drawer-vuln-remediation-title">🛡️ Remediation Plan</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {vuln.remediation}
                      </div>
                    </div>

                    {/* References lists */}
                    {vuln.references && vuln.references.length > 0 && (
                      <div className="drawer-vuln-refs">
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Advisory References:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {vuln.references.slice(0, 4).map((ref, rIdx) => (
                            <a 
                              key={rIdx} 
                              href={ref.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="drawer-ref-link"
                            >
                              ↳ {ref.label || ref.url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        </>
      )}

    </div>
  );
}
