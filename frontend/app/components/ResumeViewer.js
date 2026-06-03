'use client';

import { useState } from 'react';
import LatexEditor from './LatexEditor';

export default function ResumeViewer({ jobId, company, role }) {
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRecompileComplete = () => {
    // Increment the refreshKey to force iframe reload without page flashing
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className={`btn ${open ? 'btn-ghost' : 'btn-primary'}`}
          style={{ justifyContent: 'center', flex: 1 }}
          onClick={() => setOpen(prev => !prev)}
        >
          {open ? '✕ Close Preview' : '👁 Preview Resume'}
        </button>

        {open && (
          <button
            className="btn btn-secondary"
            style={{ justifyContent: 'center', flex: 1 }}
            onClick={() => setEditorOpen(true)}
          >
            ✏️ Edit LaTeX
          </button>
        )}
      </div>

      {open && (
        <div style={{
          marginTop: '16px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#525659',
        }}>
          <iframe
            src={`/api/resume/${jobId}?format=pdf&mode=inline&t=${refreshKey}`}
            style={{
              width: '100%',
              height: '80vh',
              border: 'none',
              display: 'block',
            }}
            title="Resume Preview"
          />
        </div>
      )}

      {editorOpen && (
        <LatexEditor
          jobId={jobId}
          company={company}
          role={role}
          onClose={() => setEditorOpen(false)}
          onRecompileComplete={handleRecompileComplete}
        />
      )}
    </div>
  );
}
