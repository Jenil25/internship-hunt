import { getStats } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function getStatusBadge(status) {
  const map = {
    resume_generated: { class: 'badge-success', label: 'Resume Generated' },
    scored: { class: 'badge-info', label: 'Scored' },
    ineligible: { class: 'badge-error', label: 'Ineligible' },
  };
  const s = map[status] || { class: 'badge-neutral', label: status };
  return <span className={`badge ${s.class}`}>{s.label}</span>;
}

export default async function Dashboard() {
  const session = await auth();
  let stats;
  try {
    stats = await getStats(session.user.email);
  } catch (e) {
    return (
      <div>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>Overview of your internship hunt pipeline</p>
        </div>
        <div className="status-message error">
          ⚠️ Could not connect to database. Make sure PostgreSQL is running.
        </div>
      </div>
    );
  }

  const { totals, scoreDistribution, recentJobs } = stats;
  const maxCount = Math.max(...scoreDistribution.map(d => parseInt(d.count)), 1);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your internship hunt pipeline</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{totals.total_jobs}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Resumes Generated</div>
          <div className="stat-value">{totals.resumes_generated}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">{totals.avg_score || '—'}</div>
        </div>
        <div className="stat-card error">
          <div className="stat-label">Max Score</div>
          <div className="stat-value">{totals.max_score || '—'}</div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Score Distribution</h3>
          {scoreDistribution.length > 0 ? (
            <div className="distribution-chart" style={{ paddingBottom: '32px' }}>
              {scoreDistribution.map((d) => (
                <div
                  key={d.range}
                  className="distribution-bar"
                  style={{ height: `${(parseInt(d.count) / maxCount) * 100}%` }}
                >
                  <span className="bar-count">{d.count}</span>
                  <span className="bar-label">{d.range}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>No scored jobs yet</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a href="/upload" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              📤 Upload Job Description
            </a>
            <a href="/jobs" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
              💼 View All Jobs
            </a>
            <a href="/resumes" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
              📄 View Resumes
            </a>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '32px' }}>
        <div className="table-header">
          <h3>Recent Jobs</h3>
          <a href="/jobs" className="btn btn-ghost btn-sm">View All →</a>
        </div>
        {recentJobs.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <a href={`/jobs/${job.id}`} className="job-link" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {job.company}
                    </a>
                  </td>
                  <td>{job.role}</td>
                  <td>
                    <span className={`score-pill score-${getScoreClass(job.score)}`}>
                      {job.score}
                    </span>
                  </td>
                  <td>{getStatusBadge(job.status)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No jobs yet</h3>
            <p>Upload a job description to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
