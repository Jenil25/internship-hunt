import { getJobs } from '@/lib/db';
import { auth } from '@/lib/auth';
import KanbanDashboard from '@/app/components/KanbanDashboard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
// How many of the most recent jobs the board loads. The board renders all five columns
// at once so it cannot page; past this it says so rather than silently dropping rows.
const BOARD_WINDOW = 200;

// Filter key -> the statuses it selects. Kept in sync with the board columns.
const STATUS_FILTERS = {
  ready: ['scored', 'resume_generated'],
  applied: ['applied'],
  interviewing: ['interviewing'],
};

export default async function JobsPage({ searchParams }) {
  const session = await auth();
  const sp = await searchParams;

  const view = sp.view === 'table' ? 'table' : 'board';
  const statusFilter = STATUS_FILTERS[sp.status] ? sp.status : 'all';
  const scoreFilter = sp.score === '80';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);

  const filters = {
    statuses: STATUS_FILTERS[statusFilter],
    minScore: scoreFilter ? 80 : undefined,
  };

  // The board renders every column at once, so it reads a bounded window of the most
  // recent jobs and reports honestly when there are more. The table pages through
  // everything — filters and offset both run in SQL, so nothing is silently dropped.
  const pageQuery = view === 'table'
    ? { ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
    : { ...filters, limit: BOARD_WINDOW, offset: 0 };

  let jobs = [];
  let total = 0;
  let error = null;
  try {
    ({ jobs, total } = await getJobs(session.user.email, pageQuery));
  } catch (e) {
    error = e.message;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2>Jobs</h2>
          <p>Manage and track your job application pipeline</p>
        </div>
      </div>

      {error && (
        <div className="status-message error" style={{ marginBottom: '24px' }}>
          ⚠️ Database error: {error}
        </div>
      )}

      <KanbanDashboard
        initialJobs={jobs}
        total={total}
        view={view}
        page={page}
        pageSize={PAGE_SIZE}
        statusFilter={statusFilter}
        scoreFilter={scoreFilter}
      />
    </div>
  );
}
