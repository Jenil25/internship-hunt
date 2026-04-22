/**
 * Full NextAuth configuration — server-only (Node.js runtime).
 * Imports the edge-safe base config and adds the Credentials provider
 * which requires database access.
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rows = await query(
          'SELECT id, name, email, password_hash FROM users WHERE email = $1',
          [credentials.email]
        );
        const user = rows[0];
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) return null;

        return { id: String(user.id), name: user.name, email: user.email };
      },
    }),
  ],
});
