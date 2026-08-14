'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// PAGE_SIZE / BOARD_WINDOW live in app/jobs/page.js — a 'use client' module cannot
// export plain values to a server component, only components. pageSize arrives as a prop.

// Columns are keyed on application_state — where the user is in applying —
// except Ineligible, which is a pipeline outcome. `dropTarget: null` marks a
// column you cannot drag into: eligibility is the pipeline's call, not a status
// the user gets to assign.
const COLUMNS = [
  {
    id: 'ready',
    title: '📥 To Review',
    states: ['none'],
    dropTarget: 'none',
    class: 'col-ready',
  },
  {
    id: 'applied',
    title: '📤 Applied',
    states: ['applied'],
    dropTarget: 'applied',
    class: 'col-applied',
  },
  {
    id: 'interviewing',
    title: '🎙️ Interviewing',
    states: ['interviewing'],
    dropTarget: 'interviewing',
    class: 'col-interviewing',
  },
  {
    id: 'accepted',
    title: '🎉 Accepted / Offers',
    states: ['accepted'],
    dropTarget: 'accepted',
    class: 'col-accepted',
  },
  {
    id: 'rejected',
    title: '❌ Rejected / Passed',
    states: ['rejected', 'passed', 'no_response'],
    dropTarget: 'rejected',
    class: 'col-rejected',
  },
  {
    // Previously these matched no column at all and silently vanished from the
    // board — 11 jobs in the database, 10 on screen.
    id: 'ineligible',
    title: '🚫 Ineligible',
    states: [],
    dropTarget: null,
    class: 'col-ineligible',
  },
];

/** Which column a job belongs in. Ineligible wins regardless of funnel state. */
function columnFor(job) {
  if (job.pipeline_state === 'ineligible') return 'ineligible';
  return COLUMNS.find(c => c.states.includes(job.application_state))?.id ?? 'ready';
}

function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function getMatchBadge(level) {
  // PARTIAL_MATCH and WEAK_MATCH were missing, so those cards rendered the raw
  // "PARTIAL_MATCH" string next to friendly "Strong"/"Good" labels.
  const map = {
    STRONG_MATCH: { class: 'badge-success', label: 'Strong' },
    GOOD_MATCH: { class: 'badge-info', label: 'Good' },
    MODERATE_MATCH: { class: 'badge-warning', label: 'Moderate' },
    PARTIAL_MATCH: { class: 'badge-warning', label: 'Partial' },
    WEAK_MATCH: { class: 'badge-error', label: 'Weak' },
    LOW_MATCH: { class: 'badge-error', label: 'Low' },
    INELIGIBLE: { class: 'badge-error', label: 'Ineligible' },
  };
  const m = map[level] || {
    class: 'badge-neutral',
    // Never show a raw enum: turn anything unmapped into Title Case.
    label: level ? level.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—',
  };
  return <span className={`badge ${m.class}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{m.label}</span>;
}

function getStatusBadge(job) {
  if (job.pipeline_state === 'ineligible') {
    return <span className="badge badge-error" style={{ fontSize: '10px', padding: '2px 8px' }}>🚫 Ineligible</span>;
  }
  const map = {
    none: { class: 'badge-info', label: '📥 To Review' },
    applied: { class: 'badge-info', label: '📤 Applied' },
    interviewing: { class: 'badge-warning', label: '🎙️ Interview' },
    no_response: { class: 'badge-neutral', label: '😶 No Reply' },
    accepted: { class: 'badge-success', label: '🎉 Offer' },
    rejected: { class: 'badge-error', label: '❌ Reject' },
    passed: { class: 'badge-neutral', label: '⏭️ Passed' },
  };
  const s = map[job.application_state] || { class: 'badge-neutral', label: job.application_state };
  return <span className={`badge ${s.class}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{s.label}</span>;
}

export default function KanbanDashboard({ initialJobs, total, view, page, pageSize, statusFilter, scoreFilter }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [draggedOverCol, setDraggedOverCol] = useState(null);
  const [movingJobId, setMovingJobId] = useState(null);
  const router = useRouter();

  // View, filters and page live in the URL so the server can scope the SQL query.
  // Resync local job state whenever the server sends a different slice.
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  // Build a URL preserving the other params. Any filter change resets to page 1,
  // otherwise narrowing a filter could strand you past the end of the new result set.
  const hrefWith = (changes) => {
    const params = new URLSearchParams();
    const next = { view, status: statusFilter, score: scoreFilter ? '80' : null, page, ...changes };
    if (next.view === 'table') params.set('view', 'table');
    if (next.status && next.status !== 'all') params.set('status', next.status);
    if (next.score) params.set('score', '80');
    if (next.page > 1) params.set('page', String(next.page));
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : '/jobs';
  };

  // Remember the last view, and honour it on a bare /jobs visit.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('view')) return;
    if (localStorage.getItem('jobs-view-pref') === 'table') router.replace('/jobs?view=table');
  }, [router]);

  const handleViewChange = (newView) => {
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

    const targetCol = COLUMNS.find(c => c.id === targetColId);
    // dropTarget null means the column is not a valid destination (Ineligible).
    if (!targetCol?.dropTarget) return;
    const targetState = targetCol.dropTarget;

    // Optimistically update the UI
    const previousJobs = [...jobs];
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.id.toString() === jobId) {
        return { ...job, application_state: targetState };
      }
      return job;
    }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_state: targetState }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      // Counts and filtered result sets are computed server-side; resync them.
      router.refresh();
    } catch (err) {
      console.error('Drag update error:', err);
      // Revert if API failed
      setJobs(previousJobs);
    }
  };

  // Manual select handler for non-drag updates
  const handleStatusChange = async (jobId, newState) => {
    const previousJobs = [...jobs];
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.id === jobId) {
        return { ...job, application_state: newState };
      }
      return job;
    }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_state: newState }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      // Counts and filtered result sets are computed server-side; resync them.
      router.refresh();
    } catch (err) {
      console.error('Manual update error:', err);
      setJobs(previousJobs);
    }
  };

  // Filtering and paging happen in SQL now; `jobs` is already the correct slice.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const boardTruncated = view === 'board' && total > jobs.length;

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
        {/* Stage and score are independent filters, so each link changes only
            its own parameter and leaves the other alone — "Applied AND 80+" is
            reachable. Previously picking a stage cleared the score and picking
            the score reset the stage to All, so they could never combine. */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'ready', label: '📄 To Review' },
            { key: 'applied', label: '📤 Applied' },
            { key: 'interviewing', label: '🎙️ Interviewing' },
          ].map(f => (
            <Link
              key={f.key}
              href={hrefWith({ status: f.key, page: 1 })}
              scroll={false}
              className={`btn btn-sm ${statusFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f.label}
            </Link>
          ))}

          <span style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

          <Link
            href={hrefWith({ score: scoreFilter ? null : '80', page: 1 })}
            scroll={false}
            className={`btn btn-sm ${scoreFilter ? 'btn-primary' : 'btn-secondary'}`}
          >
            🔥 Score 80+{scoreFilter ? ' ✕' : ''}
          </Link>
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
          {[['board', '📊 Board'], ['table', '☰ Table']].map(([v, label]) => (
            <Link
              key={v}
              href={hrefWith({ view: v, page: 1 })}
              scroll={false}
              onClick={() => handleViewChange(v)}
              className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {boardTruncated && (
        <div className="board-truncated-notice">
          Showing the {jobs.length} most recent of {total} jobs.{' '}
          <Link href={hrefWith({ view: 'table', page: 1 })} scroll={false} onClick={() => handleViewChange('table')}>
            Switch to Table view
          </Link>{' '}
          to page through all of them.
        </div>
      )}

      {/* --- RENDER 1: KANBAN BOARD VIEW ---
          Column count lives in globals.css, not here: an inline
          gridTemplateColumns cannot be overridden by a media query, which is
          why the board stayed 5 columns wide at 390px and truncated every
          card to "F…". */}
      {view === 'board' && (
        <div className="kanban-board">
          {COLUMNS.map(column => {
            const columnJobs = jobs.filter(job => columnFor(job) === column.id);
            const isDraggedOver = draggedOverCol === column.id && column.dropTarget;

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

                        {/* Mobile Status Mover (Hidden on Desktop). Not shown for
                            ineligible jobs — there is no funnel state to move them to. */}
                        {job.pipeline_state !== 'ineligible' && (
                        <div className="mobile-only-controls" style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'none' }}>
                          <select
                            value={job.application_state}
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
                            <option value="none">To Review</option>
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="passed">Passed</option>
                            <option value="no_response">No Response</option>
                          </select>
                        </div>
                        )}
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
            <h3>{total} Job{total !== 1 ? 's' : ''}</h3>
            <Link href="/upload" className="btn btn-primary btn-sm">+ Upload JD</Link>
          </div>
          {jobs.length > 0 ? (
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
                {jobs.map((job) => (
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
                    <td>{getStatusBadge(job)}</td>
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
              {page > 1 ? (
                <Link href={hrefWith({ page: page - 1 })} scroll={false} className="btn btn-secondary btn-sm">
                  ← Prev
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm is-disabled">← Prev</span>
              )}
              <span>{firstRow}–{lastRow} of {total}</span>
              {page < pageCount ? (
                <Link href={hrefWith({ page: page + 1 })} scroll={false} className="btn btn-secondary btn-sm">
                  Next →
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm is-disabled">Next →</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
