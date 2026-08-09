'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 25;

const COLUMNS = [
  {
    id: 'ready',
    title: '📥 Scored / Ready',
    statuses: ['scored', 'resume_generated'],
    class: 'col-ready',
  },
  {
    id: 'applied',
    title: '📤 Applied',
    statuses: ['applied'],
    class: 'col-applied',
  },
  {
    id: 'interviewing',
    title: '🎙️ Interviewing',
    statuses: ['interviewing'],
    class: 'col-interviewing',
  },
  {
    id: 'accepted',
    title: '🎉 Accepted / Offers',
    statuses: ['accepted'],
    class: 'col-accepted',
  },
  {
    id: 'rejected',
    title: '❌ Rejected / Passed',
    statuses: ['rejected', 'pass', 'no_response'],
    class: 'col-rejected',
  },
];

function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function getMatchBadge(level) {
  const map = {
    STRONG_MATCH: { class: 'badge-success', label: 'Strong' },
    GOOD_MATCH: { class: 'badge-info', label: 'Good' },
    MODERATE_MATCH: { class: 'badge-warning', label: 'Mod' },
    LOW_MATCH: { class: 'badge-error', label: 'Low' },
  };
  const m = map[level] || { class: 'badge-neutral', label: level || '—' };
  return <span className={`badge ${m.class}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{m.label}</span>;
}

function getStatusBadge(status) {
  const map = {
    resume_generated: { class: 'badge-success', label: '📄 Ready' },
    scored: { class: 'badge-info', label: '📊 Scored' },
    applied: { class: 'badge-info', label: '📤 Applied' },
    interviewing: { class: 'badge-warning', label: '🎙️ Interview' },
    no_response: { class: 'badge-neutral', label: '😶 Ignore' },
    accepted: { class: 'badge-success', label: '🎉 Offer' },
    rejected: { class: 'badge-error', label: '❌ Reject' },
    pass: { class: 'badge-neutral', label: '⏭️ Pass' },
    ineligible: { class: 'badge-error', label: '🚫 Ineligible' },
  };
  const s = map[status] || { class: 'badge-neutral', label: status };
  return <span className={`badge ${s.class}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{s.label}</span>;
}

export default function KanbanDashboard({ initialJobs }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [view, setView] = useState('board'); // 'board' or 'table'
  const [draggedOverCol, setDraggedOverCol] = useState(null);
  const [movingJobId, setMovingJobId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState(false); // true means 80+ only
  const [page, setPage] = useState(0); // table view only; the board scrolls per column instead

  // Load view preference on mount
  useEffect(() => {
    const savedView = localStorage.getItem('jobs-view-pref');
    if (savedView === 'table' || savedView === 'board') {
      setView(savedView);
    }
  }, []);

  // Update localStorage when view changes
  const handleViewChange = (newView) => {
    setView(newView);
    localStorage.setItem('jobs-view-pref', newView);
  };

  // Drag-and-drop handlers
  const handleDragStart = (e, jobId) => {
    e.dataTransfer.setData('text/plain', jobId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      setMovingJobId(jobId);
    }, 0);
  };

  const handleDragEnd = () => {
    setMovingJobId(null);
    setDraggedOverCol(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    setDraggedOverCol(colId);
  };

  const handleDragLeave = () => {
    setDraggedOverCol(null);
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDraggedOverCol(null);
    setMovingJobId(null);

    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;

    // Find the target status (take the first status of the column as primary target)
    const targetCol = COLUMNS.find(c => c.id === targetColId);
    if (!targetCol) return;
    const targetStatus = targetCol.statuses[0];

    // Optimistically update the UI status
    const previousJobs = [...jobs];
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.id.toString() === jobId) {
        return { ...job, status: targetStatus };
      }
      return job;
    }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      console.error('Drag update error:', err);
      // Revert if API failed
      setJobs(previousJobs);
    }
  };

  // Manual select handler for non-drag updates
  const handleStatusChange = async (jobId, newStatus) => {
    const previousJobs = [...jobs];
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.id === jobId) {
        return { ...job, status: newStatus };
      }
      return job;
    }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      console.error('Manual update error:', err);
      setJobs(previousJobs);
    }
  };

  // Filter logic
  const filteredJobs = jobs.filter(job => {
    // Score Filter (80+)
    if (scoreFilter && (!job.score || job.score < 80)) return false;

    // Status Filter (mainly for Table View)
    if (statusFilter !== 'all') {
      if (statusFilter === 'ready' && !['scored', 'resume_generated'].includes(job.status)) return false;
      if (statusFilter !== 'ready' && job.status !== statusFilter) return false;
    }

    return true;
  });

  // Table pagination. Clamping (rather than resetting on filter change) keeps this
  // effect-free: if a filter shrinks the list past the current page, fall back to the last one.
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedJobs = filteredJobs.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      {/* Top Filter and View Control Bar */}
      <div className="dashboard-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Quick Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => { setStatusFilter('all'); setScoreFilter(false); }}
            className={`btn btn-sm ${statusFilter === 'all' && !scoreFilter ? 'btn-primary' : 'btn-secondary'}`}
          >
            All
          </button>
          <button
            onClick={() => { setStatusFilter('ready'); setScoreFilter(false); }}
            className={`btn btn-sm ${statusFilter === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
          >
            📄 Ready
          </button>
          <button
            onClick={() => { setStatusFilter('applied'); setScoreFilter(false); }}
            className={`btn btn-sm ${statusFilter === 'applied' ? 'btn-primary' : 'btn-secondary'}`}
          >
            📤 Applied
          </button>
          <button
            onClick={() => { setStatusFilter('interviewing'); setScoreFilter(false); }}
            className={`btn btn-sm ${statusFilter === 'interviewing' ? 'btn-primary' : 'btn-secondary'}`}
          >
            🎙️ Interviewing
          </button>
          <button
            onClick={() => { setStatusFilter('all'); setScoreFilter(true); }}
            className={`btn btn-sm ${scoreFilter ? 'btn-primary' : 'btn-secondary'}`}
          >
            🔥 Score 80+
          </button>
        </div>

        {/* Board / Table Switcher */}
        <div className="view-toggle" style={{
          display: 'inline-flex',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          gap: '4px',
        }}>
          <button
            onClick={() => handleViewChange('board')}
            className={`btn btn-sm ${view === 'board' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}
          >
            📊 Board
          </button>
          <button
            onClick={() => handleViewChange('table')}
            className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}
          >
            ☰ Table
          </button>
        </div>
      </div>

      {/* --- RENDER 1: KANBAN BOARD VIEW --- */}
      {view === 'board' && (
        <div className="kanban-board" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '10px',
          alignItems: 'start',
          paddingBottom: '16px',
          minHeight: '70vh',
        }}>
          {COLUMNS.map(column => {
            // Get jobs falling in this column
            const columnJobs = filteredJobs.filter(job => column.statuses.includes(job.status));
            const isDraggedOver = draggedOverCol === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`kanban-column ${column.class} ${isDraggedOver ? 'dragged-over' : ''}`}
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  border: isDraggedOver ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                  boxShadow: isDraggedOver ? 'var(--shadow-glow)' : 'none',
                  minHeight: '500px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '10px',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Column Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '8px',
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.title}</h4>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    borderRadius: '100px',
                    padding: '2px 6px',
                  }}>{columnJobs.length}</span>
                </div>

                {/* Column Content — scrolls within the column so a 200-job pile
                    doesn't stretch the page. Drop target is the column, not this
                    wrapper, so drag-and-drop still works while scrolled. */}
                <div className="kanban-cards-wrapper" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1,
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}>
                  {columnJobs.length > 0 ? (
                    columnJobs.map(job => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        className={`kanban-card ${movingJobId === job.id ? 'is-dragging' : ''}`}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px',
                          cursor: 'grab',
                          position: 'relative',
                          opacity: movingJobId === job.id ? 0.4 : 1,
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                        }}
                      >
                        {/* Card Title & Company */}
                        <div style={{ marginBottom: '6px' }}>
                          <Link
                            href={`/jobs/${job.id}`}
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'block',
                              marginBottom: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            className="job-card-link"
                          >
                            {job.company}
                          </Link>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {job.role}
                          </div>
                        </div>

                        {/* Badges & Score */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '10px',
                        }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span className={`score-pill score-${getScoreClass(job.score)}`} style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              fontWeight: 800,
                            }}>
                              {job.score || '—'}
                            </span>
                            {getMatchBadge(job.match_level)}
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                            {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* View Details Button */}
                        <div style={{
                          marginTop: '10px',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '8px',
                          display: 'flex',
                        }}>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              fontSize: '11px',
                              borderRadius: '6px',
                              justifyContent: 'center',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            View Details →
                          </Link>
                        </div>

                        {/* Mobile Status Mover (Hidden on Desktop) */}
                        <div className="mobile-only-controls" style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'none' }}>
                          <select
                            value={job.status}
                            onChange={(e) => handleStatusChange(job.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px',
                              fontSize: '11px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <option value="scored">Scored</option>
                            <option value="resume_generated">Ready</option>
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="pass">Passed</option>
                            <option value="no_response">No Response</option>
                          </select>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px 8px',
                      color: 'var(--text-disabled)',
                      border: '1px dashed rgba(255,255,255,0.03)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      flex: 1,
                    }}>
                      Drop jobs here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- RENDER 2: TABLE LIST VIEW --- */}
      {view === 'table' && (
        <div className="table-container">
          <div className="table-header">
            <h3>{filteredJobs.length} Job{filteredJobs.length !== 1 ? 's' : ''}</h3>
            <Link href="/upload" className="btn btn-primary btn-sm">+ Upload JD</Link>
          </div>
          {filteredJobs.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Score</th>
                  <th>Match</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedJobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {job.company}
                      {job.version > 1 && (
                        <span style={{
                          marginLeft: '8px', fontSize: '11px', fontWeight: 600,
                          padding: '1px 6px', borderRadius: '8px',
                          background: 'var(--primary)', color: 'white'
                        }}>v{job.version}</span>
                      )}
                    </td>
                    <td>{job.role}</td>
                    <td>
                      <span className={`score-pill score-${getScoreClass(job.score)}`}>
                        {job.score || '—'}
                      </span>
                    </td>
                    <td>{getMatchBadge(job.match_level)}</td>
                    <td>
                      <span className="badge badge-neutral">
                        {job.source || '—'}
                      </span>
                    </td>
                    <td>{getStatusBadge(job.status)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No jobs found</h3>
              <p>Upload a job description or adjust your filters</p>
            </div>
          )}

          {pageCount > 1 && (
            <div className="table-pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
              >
                ← Prev
              </button>
              <span>
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
