import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the user
    const [user] = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );

    // Auto-create an empty "general" profile for the new user
    await query(
      `INSERT INTO profiles (user_email, profile_name, profile_json)
       VALUES ($1, 'general', $2)
       ON CONFLICT (user_email, profile_name) DO NOTHING`,
      [
        email,
        JSON.stringify({
          identity: { name, email },
          profile: {
            name,
            contact: { email, phone: '', location: '', linkedin: '', github: '' },
            education: [],
            skills: { languages: [], frameworks: [], tools: [] },
          },
          experience: [],
          projects: [],
          skills: { languages: [], frameworks: [], tools: [] },
          config: { min_score: 65, generate_cover_letter: false },
        }),
      ]
    );

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
