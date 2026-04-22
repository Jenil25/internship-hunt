'use client';

import { useState } from 'react';

export default function ExportProfile() {
  const [open, setOpen] = useState(false);

  const exportFormats = [
    { key: 'json', label: 'JSON', icon: '{ }', desc: 'Raw data, importable' },
    { key: 'md', label: 'Markdown', icon: 'M↓', desc: 'README-style format' },
    { key: 'txt', label: 'Plain Text', icon: 'Aa', desc: 'Simple text file' },
  ];

  const handleExport = (format) => {
    window.open(`/api/profile/export?format=${format}`, '_blank');
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
      >
        📥 Export Profile
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '220px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 999,
            padding: '6px',
            animation: 'dropdownSlide 0.15s ease',
          }}>
            {exportFormats.map(f => (
              <button
                key={f.key}
                onClick={() => handleExport(f.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { e.target.style.background = 'var(--glass)'; e.target.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
              >
                <span style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-primary-glow)',
                  color: 'var(--accent-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}>
                  {f.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{f.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
