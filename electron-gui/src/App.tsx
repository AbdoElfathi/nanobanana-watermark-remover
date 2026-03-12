import { useState, useCallback } from 'react';

// Define the shape of our Electron API
interface ElectronAPI {
  selectFiles: () => Promise<string[]>;
  selectDirectory: () => Promise<string>;
  processFiles: (files: string[], options: any) => Promise<any[]>;
  onMainProcessMessage: (callback: (message: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [processedFiles, setProcessedFiles] = useState<Record<string, string>>({}); // original -> cleaned mapping
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [options, setOptions] = useState({
    denoise: 'off',
    threshold: 0.25,
    force: false,
  });

  const handleSelectFiles = async () => {
    const selectedFiles = await window.electronAPI.selectFiles();
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(prev => [...new Set([...prev, ...selectedFiles])]);
    }
  };

  const handleRemoveFile = (index: number) => {
    const file = files[index];
    setFiles(prev => prev.filter((_, i) => i !== index));
    const newProcessed = { ...processedFiles };
    delete newProcessed[file];
    setProcessedFiles(newProcessed);
  };

  const handleClearFiles = () => {
    setFiles([]);
    setProcessedFiles({});
    setProgress(0);
    setStatus('');
    setShowOriginal({});
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus(`Processing ${files.length} images...`);

    try {
      const results = [];
      const newProcessed = { ...processedFiles };
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatus(`Processing ${i + 1}/${files.length}: ${file.split(/[\\/]/).pop()}`);
        
        const result = await window.electronAPI.processFiles([file], options);
        const fileResult = result[0];
        
        if (fileResult.code === 0 && fileResult.outputFile) {
          newProcessed[file] = fileResult.outputFile;
        }
        
        results.push(fileResult);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setProcessedFiles(newProcessed);
      setStatus(`Successfully processed ${files.length} images. Check 'cleaned' subfolders.`);
    } catch (error) {
      console.error('Processing failed:', error);
      setStatus('An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => file.path);
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...new Set([...prev, ...droppedFiles])]);
    }
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>Gemini Watermark Tool</h1>
        <p>Intelligent batch watermark removal for AI-generated images</p>
      </header>

      <main>
        <div 
          className="card drop-zone"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleSelectFiles}
        >
          {files.length === 0 ? (
            <div>
              <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Drag & Drop images here</p>
              <p style={{ color: '#64748b' }}>or click to browse</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '1.2rem' }}>{files.length} images selected</p>
              <button onClick={(e) => { e.stopPropagation(); handleClearFiles(); }} style={{ marginTop: '1rem' }}>
                Clear All
              </button>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="card">
            <div className="image-list">
              {files.map((file, index) => {
                const isProcessed = !!processedFiles[file];
                const showingOriginal = showOriginal[file] !== false;
                const displayPath = (isProcessed && !showingOriginal) ? processedFiles[file] : file;
                const normalizedDisplayPath = displayPath.startsWith('/') ? displayPath : '/' + displayPath;
                
                return (
                  <div key={index} className="image-item" style={{ cursor: isProcessed ? 'pointer' : 'default' }} 
                       onClick={() => isProcessed && setShowOriginal(prev => ({...prev, [file]: !showingOriginal}))}>
                    <img src={`media://${normalizedDisplayPath}?t=${Date.now()}`} alt="preview" onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                    }} />
                    {isProcessed && (
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        fontSize: '10px',
                        background: showingOriginal ? '#ef4444' : '#10b981',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        {showingOriginal ? 'ORIGINAL' : 'CLEANED'}
                      </div>
                    )}
                    <div className="remove" onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}>×</div>
                  </div>
                );
              })}
            </div>

            <div className="controls">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="setting-group">
                  <label>Denoise Method</label>
                  <select 
                    value={options.denoise} 
                    onChange={(e) => setOptions({...options, denoise: e.target.value})}
                  >
                    <option value="off">Off</option>
                    <option value="ai">AI Denoise (Highest Quality)</option>
                    <option value="ns">Navier-Stokes</option>
                    <option value="telea">Telea</option>
                    <option value="gaussian">Soft Gaussian</option>
                  </select>
                </div>
                <div className="setting-group">
                  <label>Detection Threshold ({options.threshold})</label>
                  <input 
                    type="range" 
                    min="0.05" 
                    max="1.0" 
                    step="0.05" 
                    value={options.threshold}
                    onChange={(e) => setOptions({...options, threshold: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="setting-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="force" 
                  checked={options.force}
                  onChange={(e) => setOptions({...options, force: e.target.checked})}
                />
                <label htmlFor="force" style={{ fontWeight: 'normal' }}>
                  Force process (bypass detection)
                </label>
              </div>

              <button 
                className="btn-primary" 
                onClick={handleProcess} 
                disabled={isProcessing || files.length === 0}
                style={{ padding: '1rem', fontSize: '1.1rem' }}
              >
                {isProcessing ? 'Processing...' : `Remove Watermarks from ${files.length} Images`}
              </button>
            </div>

            {isProcessing || progress > 0 ? (
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="status-text">{status}</p>
              </div>
            ) : status && (
              <p className="status-text" style={{ color: '#059669', fontWeight: 'bold', textAlign: 'center' }}>{status}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
