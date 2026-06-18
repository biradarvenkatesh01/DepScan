import React, { useState } from 'react';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export default function Dropzone({ onFileSelected, isLoading }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    const validNames = ['package.json', 'package-lock.json', 'requirements.txt'];
    const nameLower = file.name.toLowerCase();

    if (!validNames.includes(nameLower)) {
      setError('Unsupported file. Only package.json, package-lock.json, and requirements.txt are supported.');
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Pre-configured sample files to enable instant 1-click scanning
  const handleLoadSample = (sampleType: 'node' | 'node-react' | 'python') => {
    let content = '';
    let filename = '';
    let type = 'application/json';

    if (sampleType === 'node') {
      content = JSON.stringify({
        name: "test-vulnerable-project",
        version: "1.0.0",
        dependencies: {
          "lodash": "4.17.20",
          "axios": "0.21.1"
        }
      }, null, 2);
      filename = 'package.json';
    } else if (sampleType === 'node-react') {
      content = JSON.stringify({
        name: "react-app-sample",
        version: "1.0.0",
        dependencies: {
          "axios": "0.21.1",
          "react": "18.2.0"
        }
      }, null, 2);
      filename = 'package.json';
    } else {
      content = "requests==2.25.0\njinja2==2.11.2\n";
      filename = 'requirements.txt';
      type = 'text/plain';
    }

    const blob = new Blob([content], { type });
    const file = new File([blob], filename, { type });
    onFileSelected(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <label 
        className={`dropzone ${isDragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{ display: 'flex' }}
      >
        <input 
          type="file" 
          className="file-input" 
          accept=".json,text/plain"
          onChange={handleInputChange}
          disabled={isLoading}
        />
        
        <div className="dropzone-icon-container">
          <span className="dropzone-icon">🛡️</span>
        </div>
        
        <div>
          <h3 className="dropzone-title">
            {isDragActive ? 'Release to initiate scan' : 'Drop your manifest file'}
          </h3>
          <p className="dropzone-subtitle">
            or click to browse — supports package.json, package-lock.json, requirements.txt
          </p>
        </div>

        <div className="supported-formats">
          <span className="format-badge">package.json</span>
          <span className="format-badge">package-lock.json</span>
          <span className="format-badge">requirements.txt</span>
        </div>
      </label>

      {/* Quickstart sample manifests */}
      <div className="quickstart-container">
        <span className="quickstart-title">— or try a sample scan —</span>
        <div className="quickstart-buttons">
          <button 
            className="quickstart-btn" 
            onClick={() => handleLoadSample('node')}
            disabled={isLoading}
          >
            node · lodash + axios
          </button>
          <button 
            className="quickstart-btn" 
            onClick={() => handleLoadSample('node-react')}
            disabled={isLoading}
          >
            react · axios
          </button>
          <button 
            className="quickstart-btn" 
            onClick={() => handleLoadSample('python')}
            disabled={isLoading}
          >
            python · requests + jinja2
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          <span>⚠️ <strong>Error:</strong> {error}</span>
          <button className="error-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
    </div>
  );
}
