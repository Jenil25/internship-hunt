import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ResumesPage() {
  let jobs = [];
  let error = null;
  
  try {
    jobs = await query(`
      SELECT id, company, role, score, match_level, resume_file_path, created_at 
      FROM jobs 
      WHERE status = 'resume_generated' AND resume_file_path IS NOT NULL
      ORDER BY created_at DESC
    `);
  } catch (e) {
    error = e.message;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Resumes</h2>
        <p>Generated tailored resumes ready for download</p>
      </div>

      {error && (
        <div className="status-message error">⚠️ Database error: {error}</div>
      )}

      {jobs.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {jobs.map((job) => {
            const pdfPath = job.resume_file_path?.replace('.tex', '.pdf');
            return (
              <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{job.company}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{job.role}</p>
                  </div>
                  <span className={`score-pill score-${job.score >= 80 ? 'high' : job.score >= 60 ? 'mid' : 'low'}`}>
                    {job.score}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  <span className={`badge badge-${job.match_level === 'STRONG_MATCH' || job.match_level === 'GOOD_MATCH' ? 'success' : 'warning'}`}>
                    {job.match_level?.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <a href={`/api/resume/${job.id}?format=pdf`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    📥 PDF
                  </a>
                  <a href={`/api/resume/${job.id}?format=tex`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    📄 .tex
                  </a>
                  <Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No resumes yet</h3>
          <p>Upload a job description and score 80+ to generate a tailored resume</p>
          <a href="/upload" className="btn btn-primary" style={{ marginTop: '16px' }}>Upload JD</a>
        </div>
      )}
    </div>
  );
}
