/**
 * Full NextAuth configuration — server-only (Node.js runtime).
 * Imports the edge-safe base config and adds the Credentials provider
 * which requires database access.
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query, getJobById } from '@/lib/db';
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

/**
 * The single ownership gate for anything addressed by job id.
 *
 * Returns the job only if the signed-in user owns it, and null otherwise —
 * collapsing "not signed in", "no such job", and "someone else's job" into one
 * indistinguishable outcome. Callers return 404 for null (never 403), so the
 * response cannot be used to probe which ids exist.
 *
 * The owner identity comes from the session, never from the request, so a
 * client-supplied user id or email has no effect on what is returned.
 *
 * New routes that take a job id should call this rather than getJobById.
 */
export async function requireOwnedJob(id) {
  const session = await auth();
  if (!session?.user?.email) return null;
  return getJobById(id, session.user.email);
}
