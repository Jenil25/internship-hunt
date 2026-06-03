import { getJobs } from '@/lib/db';
import { auth } from '@/lib/auth';
import KanbanDashboard from '@/app/components/KanbanDashboard';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const session = await auth();
  
  let jobs = [];
  let error = null;
  try {
    // Fetch all jobs for this user to allow seamless client-side filtering and board display
    jobs = await getJobs(session.user.email);
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

      <KanbanDashboard initialJobs={jobs} />
    </div>
  );
}
