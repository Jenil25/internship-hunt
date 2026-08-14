import { setApplicationState } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Where the user is in applying. Pipeline outcomes (scored / ineligible) are
// deliberately absent — those belong to the pipeline, not to a user action.
const VALID_APPLICATION_STATES = [
  'none',
  'applied',
  'interviewing',
  'accepted',
  'rejected',
  'no_response',
  'passed',
];

// Old kanban/dropdown values, kept so a stale client bundle still works.
const LEGACY_ALIASES = {
  pass: 'passed',
  scored: 'none',
  resume_generated: 'none',
};

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only these two keys are ever consulted, and only after the value matches
    // the allowlist — nothing else on the body can reach the UPDATE.
    const requested = body.application_state ?? body.status;
    const next = LEGACY_ALIASES[requested] ?? requested;

    if (!VALID_APPLICATION_STATES.includes(next)) {
      return NextResponse.json(
        { error: `Invalid application_state. Must be one of: ${VALID_APPLICATION_STATES.join(', ')}` },
        { status: 400 }
      );
    }

    // Scoped by the session's email, so a job belonging to someone else
    // matches nothing and comes back as the same 404 as a missing id.
    const updated = await setApplicationState(id, next, session.user.email);
    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
