import { auth } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getProfile(session.user.email);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profile_json } = await request.json();
  if (!profile_json) {
    return NextResponse.json({ error: 'profile_json is required' }, { status: 400 });
  }

  const updated = await updateProfile(session.user.email, 'general', profile_json);
  if (!updated) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}
