import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes: login, signup, API auth endpoints
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/api/auth');

  if (!req.auth && !isPublicRoute) {
    const loginUrl = new URL('/login', req.url);
    return Response.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup
  if (req.auth && (pathname === '/login' || pathname === '/signup')) {
    return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
