import { updateJobStatus } from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const VALID_STATUSES = [
  'scored',
  'resume_generated',
  'ineligible',
  'applied',
  'interviewing',
  'no_response',
  'accepted',
  'rejected',
  'pass',
];

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { id } = await params;
    // Only `status` is read off the body, and only after it matches the
    // allowlist — no other field of the request can reach the UPDATE.
    const { status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Scoped by the session's email, so a job belonging to someone else
    // matches nothing and comes back as the same 404 as a missing id.
    const updated = await updateJobStatus(id, status, session.user.email);
    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
