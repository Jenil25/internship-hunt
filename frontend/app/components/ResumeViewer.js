'use client';

import { useState } from 'react';

export default function ResumeViewer({ jobId }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className={`btn ${open ? 'btn-ghost' : 'btn-primary'}`}
        style={{ justifyContent: 'center', width: '100%' }}
        onClick={() => setOpen(prev => !prev)}
      >
        {open ? '✕ Close Preview' : '👁 Preview Resume'}
      </button>

      {open && (
        <div style={{
          marginTop: '16px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#525659',
        }}>
          <iframe
            src={`/api/resume/${jobId}?format=pdf&mode=inline`}
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
    </div>
  );
}
