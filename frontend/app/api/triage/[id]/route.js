import { setApplicationState, skipJob } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * The two triage decisions.
 *
 *   apply → application_state = 'applied'
 *   skip  → application_state = 'passed'
 *
 * Both stamp reviewed_at, which is what removes the job from the queue. That is
 * tracked separately from the funnel state on purpose: a job can later move
 * applied → interviewing → rejected without ever coming back to be re-decided.
 */
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { id } = await params;
    const { decision } = await request.json();

    if (decision !== 'apply' && decision !== 'skip') {
      return NextResponse.json({ error: "decision must be 'apply' or 'skip'" }, { status: 400 });
    }

    const updated = decision === 'apply'
      ? await setApplicationState(id, 'applied', session.user.email)
      : await skipJob(id, session.user.email);

    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
