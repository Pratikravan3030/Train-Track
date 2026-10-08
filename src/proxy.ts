import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public assets, Next.js internals, and NextAuth endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('favicon.ico') ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  // 2. Fetch authenticated token
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = Boolean(token);
  const isLoginPage = pathname === '/login';

  // 3. If already authenticated and trying to access /login, redirect to dashboard
  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 4. If not authenticated:
  if (!isAuthenticated) {
    // Return 401 JSON for API calls
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to access this API.' },
        { status: 401 }
      );
    }

    // Redirect to login for pages
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Role-based route guard
  const userRole = token?.role;

  // Students attempting to access admin-only pages or operations
  if (userRole === 'STUDENT') {
    // Allow student to access specific student routes and public pages
    // We will expand student routes in Phase 6
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
