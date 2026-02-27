import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

const USER_EMAIL = 'jenilmahy25@gmail.com';
const PROFILE_NAME = 'general';

export async function GET() {
  try {
    const rows = await query(
      "SELECT id, user_email, profile_name, profile_json, updated_at FROM profiles WHERE user_email = $1 AND profile_name = $2",
      [USER_EMAIL, PROFILE_NAME]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const profileJson = body.profile_json;
    
    if (!profileJson) {
      return NextResponse.json({ error: 'profile_json is required' }, { status: 400 });
    }
    
    const rows = await query(
      `UPDATE profiles 
       SET profile_json = $1, updated_at = NOW() 
       WHERE user_email = $2 AND profile_name = $3
       RETURNING id, user_email, profile_name, updated_at`,
      [JSON.stringify(profileJson), USER_EMAIL, PROFILE_NAME]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, ...rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
