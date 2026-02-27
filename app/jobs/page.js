import { getJobs } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function getStatusBadge(status) {
  const map = {
    resume_generated: { class: 'badge-success', label: '📄 Resume Ready' },
    scored: { class: 'badge-info', label: '📊 Scored' },
    applied: { class: 'badge-info', label: '📤 Applied' },
    interviewing: { class: 'badge-warning', label: '🎙️ Interviewing' },
    no_response: { class: 'badge-neutral', label: '😶 No Response' },
    accepted: { class: 'badge-success', label: '🎉 Accepted' },
    rejected: { class: 'badge-error', label: '❌ Rejected' },
    pass: { class: 'badge-neutral', label: '⏭️ Pass' },
    ineligible: { class: 'badge-error', label: '🚫 Ineligible' },
    error: { class: 'badge-error', label: '⚠️ Error' },
  };
  const s = map[status] || { class: 'badge-neutral', label: status };
  return <span className={`badge ${s.class}`}>{s.label}</span>;
}

function getMatchBadge(level) {
  const map = {
    STRONG_MATCH: { class: 'badge-success', label: '🔥 Strong' },
    GOOD_MATCH: { class: 'badge-info', label: '✅ Good' },
    MODERATE_MATCH: { class: 'badge-warning', label: '⚡ Moderate' },
    LOW_MATCH: { class: 'badge-error', label: '❌ Low' },
  };
  const m = map[level] || { class: 'badge-neutral', label: level || '—' };
  return <span className={`badge ${m.class}`}>{m.label}</span>;
}

export default async function JobsPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status || null;
  const minScore = params?.minScore ? parseInt(params.minScore) : null;

  let jobs = [];
  let error = null;
  try {
    jobs = await getJobs({ status, minScore });
  } catch (e) {
    error = e.message;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Jobs</h2>
        <p>All processed job descriptions and their scores</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <a href="/jobs" className={`btn btn-sm ${!status && !minScore ? 'btn-primary' : 'btn-secondary'}`}>
          All
        </a>
        <a href="/jobs?status=resume_generated" className={`btn btn-sm ${status === 'resume_generated' ? 'btn-primary' : 'btn-secondary'}`}>
          📄 Resume Ready
        </a>
        <a href="/jobs?status=applied" className={`btn btn-sm ${status === 'applied' ? 'btn-primary' : 'btn-secondary'}`}>
          📤 Applied
        </a>
        <a href="/jobs?status=interviewing" className={`btn btn-sm ${status === 'interviewing' ? 'btn-primary' : 'btn-secondary'}`}>
          🎙️ Interviewing
        </a>
        <a href="/jobs?status=accepted" className={`btn btn-sm ${status === 'accepted' ? 'btn-primary' : 'btn-secondary'}`}>
          🎉 Accepted
        </a>
        <a href="/jobs?status=rejected" className={`btn btn-sm ${status === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}>
          ❌ Rejected
        </a>
        <a href="/jobs?status=ineligible" className={`btn btn-sm ${status === 'ineligible' ? 'btn-primary' : 'btn-secondary'}`}>
          🚫 Ineligible
        </a>
        <a href="/jobs?minScore=80" className={`btn btn-sm ${minScore === 80 ? 'btn-primary' : 'btn-secondary'}`}>
          🔥 Score 80+
        </a>
      </div>

      {error && (
        <div className="status-message error">⚠️ Database error: {error}</div>
      )}

      <div className="table-container">
        <div className="table-header">
          <h3>{jobs.length} Job{jobs.length !== 1 ? 's' : ''}</h3>
          <a href="/upload" className="btn btn-primary btn-sm">+ Upload JD</a>
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
            <p>{status ? 'Try a different filter' : 'Upload a job description to get started'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
