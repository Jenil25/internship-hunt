'use client';

import { useState, useEffect } from 'react';

export default function LatexEditor({ jobId, company, role, onClose, onRecompileComplete }) {
  const [texContent, setTexContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState(null);
  const [errorLog, setErrorLog] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [compileSuccess, setCompileSuccess] = useState(false);

  // Fetch current raw LaTeX string on mount
  useEffect(() => {
    async function fetchTex() {
      try {
        const res = await fetch(`/api/resume/${jobId}?format=tex`);
        if (!res.ok) {
          throw new Error('Failed to fetch LaTeX source code');
        }
        const text = await res.text();
        setTexContent(text);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTex();
  }, [jobId]);

  const handleSave = async () => {
    setCompiling(true);
    setError(null);
    setErrorLog('');
    setCompileSuccess(false);

    try {
      const res = await fetch(`/api/resume/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texContent }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'LaTeX compilation failed');
      }

      // Success! Update local preview key to refresh iframe
      setRefreshKey(prev => prev + 1);
      setCompileSuccess(true);
      
      // Notify parent about recompile, so dashboard updates too
      onRecompileComplete();
      
      // Clear success notification after 3 seconds
      setTimeout(() => {
        setCompileSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
      if (err.message.includes('compilation failed') || data.log) {
        setErrorLog(data.log || err.message || 'Check compilation details below.');
      }
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div className="latex-immersive-editor">
      {/* Immersive Header */}
      <div className="latex-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>✏️</span>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Overleaf Resume Editor
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              {company || 'Tailored Resume'} · {role || 'Job Customization'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {compileSuccess && (
            <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600, animation: 'fadeIn 0.2s' }}>
              ✓ Compiled Successfully!
            </span>
          )}
          
          <button
            onClick={handleSave}
            className="btn btn-primary btn-sm"
            disabled={compiling || loading}
            style={{
              minWidth: '140px',
              justifyContent: 'center',
              boxShadow: compiling ? 'none' : '0 0 15px rgba(59, 130, 246, 0.4)',
            }}
          >
            {compiling ? (
              <>
                <div className="spinner" style={{ borderTopColor: '#fff', width: '12px', height: '12px' }} /> Compiling...
              </>
            ) : (
              '🚀 Recompile'
            )}
          </button>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            disabled={compiling}
            style={{ padding: '6px 12px' }}
          >
            ✕ Close Editor
          </button>
        </div>
      </div>

      {/* Editor Workspace */}
      <div className="latex-editor-workspace">
        {/* Left: Code Pane */}
        <div className="latex-editor-code-pane">
          {loading ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading LaTeX source code...</p>
            </div>
          ) : error && !texContent ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', padding: '20px' }}>
              <span style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</span>
              <p>{error}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
              <textarea
                className="latex-editor-textarea"
                value={texContent}
                onChange={(e) => setTexContent(e.target.value)}
                placeholder="% LaTeX code goes here..."
                disabled={compiling}
              />
              {error && (
                <div className="latex-error-log" style={{ margin: '16px', maxHeight: '200px' }}>
                  <strong>⚠️ Error: {error}</strong>
                  {errorLog && <div style={{ marginTop: '8px', color: '#FDA4AF' }}>{errorLog}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: PDF Preview Pane */}
        <div className="latex-editor-preview-pane">
          {loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', background: '#3A3D42' }}>
              <p style={{ color: '#E2E8F0', fontSize: '14px' }}>Waiting for LaTeX source...</p>
            </div>
          ) : (
            <iframe
              src={`/api/resume/${jobId}?format=pdf&mode=inline&t=${refreshKey}`}
              className="latex-editor-preview-iframe"
              title="Compiled Resume Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
