import { getJobById, getJobVersions } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StatusDropdown from '@/app/components/StatusDropdown';
import CopyButton from '@/app/components/CopyButton';

export const dynamic = 'force-dynamic';

function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

export default async function JobDetailPage({ params }) {
  const { id } = await params;
  const job = await getJobById(id);
  const versions = job ? await getJobVersions(job.company, job.role, job.user_email) : [];

  if (!job) {
    notFound();
  }

  let reasoning = null;
  if (job.reasoning) {
    try {
      reasoning = typeof job.reasoning === 'string' ? JSON.parse(job.reasoning) : job.reasoning;
    } catch (e) {
      reasoning = null;
    }
  }

  const hasResume = job.resume_file_path && job.status !== 'ineligible';
  const hasHook = job.hook && job.hook !== 'Error parsing AI response';
  const hasCoverLetter = job.cover_letter_text && job.cover_letter_text.trim();

  return (
    <div>
      <Link href="/jobs" className="back-link">← Back to Jobs</Link>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <h2>{job.company}</h2>
          {job.version && (
            <span style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
              color: 'white', padding: '2px 10px', borderRadius: '12px',
              fontSize: '13px', fontWeight: 600
            }}>v{job.version}</span>
          )}
          <StatusDropdown jobId={job.id} currentStatus={job.status} />
        </div>
        <p>{job.role}</p>
        {versions.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Versions:</span>
            {versions.map(v => (
              <Link
                key={v.id}
                href={`/jobs/${v.id}`}
                style={{
                  padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  textDecoration: 'none', transition: 'all 0.2s',
                  background: v.id === job.id ? 'var(--primary)' : 'var(--bg-elevated)',
                  color: v.id === job.id ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${v.id === job.id ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                v{v.version} · {v.score}%
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="detail-grid">
        {/* Main Content */}
        <div>
          {/* Score Card */}
          <div className="card card-glow" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  Match Score
                </div>
                <div style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: job.score >= 80 ? 'var(--success)' : job.score >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                  {job.score}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="score-bar" style={{ marginBottom: '8px' }}>
                  <div className={`score-bar-fill ${getScoreClass(job.score)}`} 
                       style={{ width: `${job.score}%` }} />
                </div>
                <span className={`badge badge-${job.match_level === 'STRONG_MATCH' || job.match_level === 'GOOD_MATCH' ? 'success' : 'warning'}`}>
                  {job.match_level?.replace('_', ' ') || 'Not rated'}
                </span>
              </div>
            </div>
          </div>

          {/* Outreach Hook Card */}
          {hasHook && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>💬</span> Outreach Message
                </h3>
                <CopyButton text={job.hook} label="Copy Message" />
              </div>
              <p style={{ 
                fontSize: '15px', 
                lineHeight: 1.7, 
                color: 'var(--text-primary)', 
                padding: '16px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: 'var(--radius-sm)',
                fontStyle: 'italic',
                borderLeft: '3px solid var(--primary)'
              }}>
                &ldquo;{job.hook}&rdquo;
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                💡 Use this as a LinkedIn message, cold email opener, or cover letter intro tailored to {job.company}.
              </p>
            </div>
          )}

          {/* Cover Letter Card */}
          {hasCoverLetter && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(78, 205, 196, 0.3)', background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.06), rgba(78, 205, 196, 0.02))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>✉️</span> Cover Letter
                </h3>
                <CopyButton text={job.cover_letter_text} label="Copy Letter" />
              </div>
              <div style={{ 
                fontSize: '14px', 
                lineHeight: 1.8, 
                color: 'var(--text-primary)', 
                padding: '20px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--success)',
                whiteSpace: 'pre-wrap'
              }}>
                {job.cover_letter_text}
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          {reasoning && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>AI Analysis</h3>
              
              {reasoning.strengths && reasoning.strengths.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600, marginBottom: '8px' }}>
                    ✅ Strengths
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {reasoning.strengths.map((s, i) => (
                      <li key={i} style={{ padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', fontSize: '14px' }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reasoning.gaps && reasoning.gaps.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: 600, marginBottom: '8px' }}>
                    ⚡ Gaps
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {reasoning.gaps.map((g, i) => (
                      <li key={i} style={{ padding: '8px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', fontSize: '14px' }}>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reasoning.recommendation && (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--info)', fontWeight: 600, marginBottom: '8px' }}>
                    💡 Recommendation
                  </div>
                  <p style={{ padding: '8px 12px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', fontSize: '14px', lineHeight: 1.6 }}>
                    {reasoning.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Job Description */}
          {job.job_description && (
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Job Description</h3>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'var(--font-sans)', 
                fontSize: '14px', 
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {job.job_description}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Actions */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hasResume && (
                <>
                  <a href={`/api/resume/${job.id}?format=pdf`} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                    📥 Download PDF
                  </a>
                  <a href={`/api/resume/${job.id}?format=tex`} className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                    📄 Download .tex
                  </a>
                </>
              )}
              {job.source_url && (
                <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  🔗 View Job Posting
                </a>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Details</h3>
            
            <div className="detail-field">
              <div className="field-label">Company</div>
              <div className="field-value">{job.company}</div>
            </div>

            <div className="detail-field">
              <div className="field-label">Role</div>
              <div className="field-value">{job.role}</div>
            </div>

            <div className="detail-field">
              <div className="field-label">Location</div>
              <div className="field-value">{job.location || '—'}</div>
            </div>

            <div className="detail-field">
              <div className="field-label">Source</div>
              <div className="field-value">{job.source || '—'}</div>
            </div>

            <div className="detail-field">
              <div className="field-label">Submitted</div>
              <div className="field-value">
                {new Date(job.created_at).toLocaleString()}
              </div>
            </div>

            {job.resume_file_path && (
              <div className="detail-field">
                <div className="field-label">Resume Path</div>
                <div className="field-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', wordBreak: 'break-all' }}>
                  {job.resume_file_path}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
