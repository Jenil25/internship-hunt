/**
 * Auth configuration that is safe for the Edge Runtime.
 * Contains NO database imports — only pages, callbacks, and session config.
 * Used by middleware.js (Edge) and re-exported by auth.js (Node).
 */

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublicRoute =
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/api/auth');

      if (!isLoggedIn && !isPublicRoute) return false; // → redirects to signIn page
      if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
        return Response.redirect(new URL('/', request.url));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
      }
      return session;
    },
  },
  providers: [], // Populated in auth.js (server-only)
};
