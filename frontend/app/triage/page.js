import { auth } from '@/lib/auth';
import { getTriageQueue, getTriageCount } from '@/lib/db';
import TriageQueue from '@/app/components/TriageQueue';

export const dynamic = 'force-dynamic';

// How many jobs to load per visit. A daily queue, not the whole backlog —
// the point is to make the decision finite.
const DAILY_BATCH = 10;

export default async function TriagePage() {
  const session = await auth();

  let jobs = [];
  let remaining = 0;
  let error = null;
  try {
    [jobs, remaining] = await Promise.all([
      getTriageQueue(session.user.email, DAILY_BATCH),
      getTriageCount(session.user.email),
    ]);
  } catch (e) {
    error = e.message;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Today&apos;s Queue</h2>
        <p>Your highest-scoring undecided jobs, one at a time. Apply or skip — both clear it from the queue.</p>
      </div>

      {error && <div className="status-message error">⚠️ Database error: {error}</div>}

      <TriageQueue initialJobs={jobs} remaining={remaining} batchSize={DAILY_BATCH} />
    </div>
  );
}
