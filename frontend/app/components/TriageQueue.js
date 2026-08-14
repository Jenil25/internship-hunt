'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * One job on screen, two decisions. This is a decision surface, not a
 * dashboard: everything shown is here to answer "do I apply to this or not",
 * and nothing else competes for attention.
 */
export default function TriageQueue({ initialJobs, remaining, batchSize }) {
  const [queue, setQueue] = useState(initialJobs);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [decided, setDecided] = useState(0);
  // Resume generation runs after the card has already advanced, so its progress
  // and failures need somewhere to show that is not the current card.
  const [resumes, setResumes] = useState([]);
  const router = useRouter();

  const job = queue[index];

  /**
   * Kick off generation without blocking the queue. Applying is the decision
   * that matters and it is already saved; a Gemini or LaTeX outage should slow
   * nothing down and lose nothing.
   */
  function generateResume(target) {
    const key = target.id;
    setResumes(rs => [{ key, company: target.company, state: 'working' }, ...rs.filter(r => r.key !== key)].slice(0, 4));

    fetch(`/api/resume/${target.id}/generate`, { method: 'POST' })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Server returned ${res.status}`);
        setResumes(rs => rs.map(r => r.key === key ? { ...r, state: 'done' } : r));
      })
      .catch(e => {
        setResumes(rs => rs.map(r => r.key === key ? { ...r, state: 'failed', message: e.message } : r));
      });
  }

  async function decide(decision) {
    if (!job || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/triage/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server returned ${res.status}`);

      // Only an application needs a tailored resume. Skips cost nothing, which
      // is the entire point of generating here instead of at scrape time.
      if (decision === 'apply' && !job.resume_file_path) generateResume(job);

      setDecided(d => d + 1);
      if (index + 1 < queue.length) {
        setIndex(i => i + 1);
      } else {
        // Batch finished — pull the next one from the server.
        router.refresh();
        setQueue([]);
      }
    } catch (e) {
      // Leave the card in place so the decision can be retried; advancing past
      // a job whose write failed would silently lose it from the queue.
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎉</div>
        <h3>{decided > 0 ? `${decided} decided — queue clear` : 'Nothing left to review'}</h3>
        <p>
          {remaining > decided
            ? `${remaining - decided} still waiting. Reload for the next batch.`
            : 'Every scored job has been decided on.'}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <Link href="/jobs" className="btn btn-secondary">View Board</Link>
          <Link href="/upload" className="btn btn-primary">Upload a JD</Link>
        </div>
        <ResumeStatus items={resumes} />
      </div>
    );
  }

  const reasoning = typeof job.reasoning === 'string'
    ? safeParse(job.reasoning)
    : job.reasoning;

  const scoreClass = job.score >= 85 ? 'high' : job.score >= 70 ? 'mid' : 'low';
  const position = decided + 1;
  const total = Math.min(remaining, decided + queue.length - index);

  return (
    <div className="triage">
      <div className="triage-progress">
        <span>{position} of {total} in this batch</span>
        <span>{Math.max(0, remaining - decided)} undecided overall</span>
      </div>

      {error && (
        <div className="status-message error" style={{ marginBottom: '16px' }}>
          ⚠️ {error} — the job is still in the queue; try again.
        </div>
      )}

      <div className="card triage-card">
        <div className="triage-head">
          <div>
            <h3>{job.company}</h3>
            <p className="triage-role">{job.role}</p>
            <p className="triage-meta">
              {[job.location, job.source].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <div className="triage-score">
            <div className={`triage-score-value score-${scoreClass}`}>{job.score ?? '—'}</div>
            <div className="triage-score-label">match score</div>
          </div>
        </div>

        {job.hook && job.hook !== 'Error parsing AI response' && (
          <p className="triage-hook">{job.hook}</p>
        )}

        <div className="triage-reasons">
          <ReasonList title="Strengths" tone="success" items={reasoning?.strengths} />
          <ReasonList title="Gaps" tone="warning" items={reasoning?.gaps} />
        </div>

        <details className="triage-jd">
          <summary>Job description</summary>
          <pre>{job.job_description || 'No description captured.'}</pre>
        </details>

        <div className="triage-actions">
          <button className="btn btn-secondary triage-skip" onClick={() => decide('skip')} disabled={busy}>
            Skip
          </button>
          <button className="btn btn-primary triage-apply" onClick={() => decide('apply')} disabled={busy}>
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>

        <div className="triage-links">
          {job.source_url && (
            <a href={job.source_url} target="_blank" rel="noopener noreferrer">Open posting ↗</a>
          )}
          <Link href={`/jobs/${job.id}`}>Full details →</Link>
        </div>
      </div>

      <ResumeStatus items={resumes} />
    </div>
  );
}

/**
 * Generation happens after the card has moved on, so results land here rather
 * than on the job being decided. A failure names the job so it can be retried
 * from that job's page.
 */
function ResumeStatus({ items }) {
  if (!items.length) return null;
  const label = {
    working: { icon: '⏳', text: 'generating resume…' },
    done: { icon: '✅', text: 'resume ready' },
    failed: { icon: '⚠️', text: 'resume failed' },
  };
  return (
    <div className="triage-resumes">
      {items.map(r => (
        <div key={r.key} className={`triage-resume-row is-${r.state}`}>
          <span>{label[r.state].icon}</span>
          <span><strong>{r.company}</strong> — {label[r.state].text}</span>
          {r.state === 'failed' && <span className="triage-resume-msg">{r.message}</span>}
          {r.state !== 'working' && <Link href={`/jobs/${r.key}`}>open →</Link>}
        </div>
      ))}
    </div>
  );
}

function ReasonList({ title, tone, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={`triage-reason-title tone-${tone}`}>{title}</div>
      <ul>
        {items.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
