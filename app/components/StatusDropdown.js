'use client';

import { useState, useRef, useEffect } from 'react';

const STATUS_OPTIONS = [
  { value: 'scored', label: 'Scored', icon: '📊', color: '#8b5cf6' },
  { value: 'resume_generated', label: 'Resume Generated', icon: '📄', color: '#6366f1' },
  { value: 'applied', label: 'Applied', icon: '📤', color: '#3b82f6' },
  { value: 'interviewing', label: 'Interviewing', icon: '🎙️', color: '#f59e0b' },
  { value: 'no_response', label: 'No Response', icon: '😶', color: '#6b7280' },
  { value: 'accepted', label: 'Accepted', icon: '🎉', color: '#10b981' },
  { value: 'rejected', label: 'Rejected', icon: '❌', color: '#ef4444' },
  { value: 'pass', label: 'Pass', icon: '⏭️', color: '#9ca3af' },
  { value: 'ineligible', label: 'Ineligible', icon: '🚫', color: '#dc2626' },
];

export default function StatusDropdown({ jobId, currentStatus }) {
  const [status, setStatus] = useState(currentStatus);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  async function handleSelect(newStatus) {
    if (newStatus === status) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="status-dropdown-wrapper">
      <button
        className="status-dropdown-trigger"
        onClick={() => setOpen(!open)}
        disabled={saving}
        style={{ '--status-color': current.color }}
      >
        <span className="status-icon">{current.icon}</span>
        <span className="status-label">{saving ? 'Saving...' : current.label}</span>
        <span className="status-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="status-dropdown-menu">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`status-dropdown-item ${opt.value === status ? 'active' : ''}`}
              onClick={() => handleSelect(opt.value)}
              style={{ '--item-color': opt.color }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              {opt.value === status && <span style={{ marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
