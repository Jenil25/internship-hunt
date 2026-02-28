'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';

export default function UploadPage() {
  const { data: session } = useSession();
  const [mode, setMode] = useState('pdf'); // 'pdf' or 'text'
  const [file, setFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [source, setSource] = useState('nuworks');
  const [status, setStatus] = useState(null); // null | 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setMode('pdf');
    }
  };

  const handleSubmit = async () => {
    setStatus('processing');
    setMessage('Submitting to pipeline... This may take 30-60 seconds.');

    try {
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/add-job';
      
      if (mode === 'pdf' && file) {
        const formData = new FormData();
        formData.append('profile_name', 'general');
        formData.append('user_email', session?.user?.email || '');
        formData.append('source', source);
        formData.append('jd_file', file);
        
        const res = await fetch(webhookUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
          setStatus('success');
          setMessage('Job submitted successfully! Processing in background. Check the Jobs page for results.');
        } else {
          throw new Error(`Server returned ${res.status}`);
        }
      } else if (mode === 'text' && jdText.trim()) {
        if (!companyName.trim()) {
          setStatus('error');
          setMessage('Company name is required when pasting text.');
          return;
        }
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_name: 'general',
            user_email: session?.user?.email || '',
            source: source,
            company_name: companyName.trim(),
            jd_text: jdText,
          }),
        });
        
        if (res.ok) {
          setStatus('success');
          setMessage('Job submitted successfully! Processing in background. Check the Jobs page for results.');
        } else {
          throw new Error(`Server returned ${res.status}`);
        }
      } else {
        setStatus('error');
        setMessage('Please provide a PDF file, or fill in both the company name and job description text.');
        return;
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Failed to submit: ${error.message}. Make sure n8n is running.`);
    }
  };

  const resetForm = () => {
    setFile(null);
    setJdText('');
    setCompanyName('');
    setStatus(null);
    setMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div className="page-header">
        <h2>Upload Job Description</h2>
        <p>Submit a PDF or paste text to score and generate a tailored resume</p>
      </div>

      {status && (
        <div className={`status-message ${status}`}>
          {status === 'processing' && <div className="spinner" />}
          {status === 'success' && '✅'}
          {status === 'error' && '⚠️'}
          {message}
          {(status === 'success' || status === 'error') && (
            <button onClick={resetForm} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
              Submit Another
            </button>
          )}
        </div>
      )}

      <div className="grid-2col">
        <div>
          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              className={`btn btn-sm ${mode === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('pdf')}
            >
              📄 Upload PDF
            </button>
            <button
              className={`btn btn-sm ${mode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('text')}
            >
              ✏️ Paste Text
            </button>
          </div>

          {mode === 'pdf' ? (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <div className="upload-icon">📄</div>
                  <h3>{file.name}</h3>
                  <p>{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                </>
              ) : (
                <>
                  <div className="upload-icon">📤</div>
                  <h3>Drop a PDF here</h3>
                  <p>or click to browse • NUWorks exports work great</p>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Google, Amazon, Deloitte..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Job Description *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Paste the full job description here..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  style={{ minHeight: '240px' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {jdText.length} characters
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Settings</h3>
            
            <div className="form-group">
              <label>Source</label>
              <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="nuworks">NUWorks</option>
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
                <option value="company_website">Company Website</option>
                <option value="direct">Direct / Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Profile</label>
              <select className="form-select" disabled>
                <option value="general">General</option>
              </select>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                More profiles coming soon
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={status === 'processing'}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              {status === 'processing' ? (
                <>
                  <div className="spinner" /> Processing...
                </>
              ) : (
                '🚀 Submit & Score'
              )}
            </button>
          </div>

          <div className="card" style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)' }}>What happens next?</h3>
            <ol style={{ listStyle: 'decimal', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li>AI extracts job details from your input</li>
              <li>Checks visa/citizenship eligibility</li>
              <li>Scores the match (0-100) against your profile</li>
              <li>If score &gt; 80, generates a tailored resume</li>
              <li>Compiles resume to PDF automatically</li>
              <li>Results saved to database & Google Sheets</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
