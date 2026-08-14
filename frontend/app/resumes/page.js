import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// The page rendered every resume at once — 364 cards, ~24,700px tall.
const PAGE_SIZE = 24;

export default async function ResumesPage({ searchParams }) {
  const session = await auth();
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const page = Math.max(1, parseInt(sp.page, 10) || 1);

  let jobs = [];
  let total = 0;
  let error = null;

  try {
    // A resume exists if the file exists. The old filter also required
    // status = 'resume_generated', so applying to a job hid its resume.
    // COUNT(*) OVER() rides along with the page, so the total costs no
    // second round trip.
    const rows = await query(`
      SELECT id, company, role, score, match_level, resume_file_path,
             application_state, created_at, COUNT(*) OVER() AS total_count
      FROM jobs
      WHERE user_email = $1
        AND resume_file_path IS NOT NULL
        AND ($2 = '' OR company ILIKE '%' || $2 || '%' OR role ILIKE '%' || $2 || '%')
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `, [session.user.email, q, PAGE_SIZE, (page - 1) * PAGE_SIZE]);

    total = rows.length ? Number(rows[0].total_count) : 0;
    jobs = rows;
  } catch (e) {
    error = e.message;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/resumes?${qs}` : '/resumes';
  };

  return (
    <div>
      <div className="page-header">
        <h2>Resumes</h2>
        <p>Generated tailored resumes ready for download</p>
      </div>

      {error && (
        <div className="status-message error">⚠️ Database error: {error}</div>
      )}

      {/* A plain GET form: the browser already does this, no client component
          and no keystroke handler needed. */}
      <form method="get" className="resumes-search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Filter by company or role…"
          className="form-input"
          aria-label="Filter resumes"
        />
        <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
        {q && <Link href="/resumes" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      {total > 0 && (
        <p className="resumes-count">
          {total} resume{total !== 1 ? 's' : ''}{q ? ` matching “${q}”` : ''}
          {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
        </p>
      )}

      {jobs.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {jobs.map((job) => (
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
                  {job.application_state !== 'none' && (
                    <span className="badge badge-neutral">{job.application_state.replace('_', ' ')}</span>
                  )}
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
            ))}
          </div>

          {pageCount > 1 && (
            <div className="table-pagination" style={{ marginTop: '24px' }}>
              {page > 1
                ? <Link href={hrefFor(page - 1)} className="btn btn-secondary btn-sm">← Prev</Link>
                : <span className="btn btn-secondary btn-sm is-disabled">← Prev</span>}
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              {page < pageCount
                ? <Link href={hrefFor(page + 1)} className="btn btn-secondary btn-sm">Next →</Link>
                : <span className="btn btn-secondary btn-sm is-disabled">Next →</span>}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>{q ? 'No resumes match that filter' : 'No resumes yet'}</h3>
          <p>
            {q
              ? 'Try a different company or role.'
              : 'Resumes are generated when you hit Apply in Today’s Queue.'}
          </p>
          <Link href={q ? '/resumes' : '/triage'} className="btn btn-primary" style={{ marginTop: '16px' }}>
            {q ? 'Clear filter' : 'Open Today’s Queue'}
          </Link>
        </div>
      )}
    </div>
  );
}
