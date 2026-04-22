import { query } from '@/lib/db';
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
    const { id } = await params;
    const { status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const rows = await query(
      'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at',
      [status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
