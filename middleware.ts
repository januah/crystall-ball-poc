import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, CRYSTAL_BALL_COOKIE_NAME } from '@/lib/supabase/auth';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

const PUBLIC_PATHS = ['/', '/share'];
const PUBLIC_API_PATHS = ['/api/auth/', '/api/public/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next.js internals and explicitly public routes
  if (
    PUBLIC_API_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/share/')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(CRYSTAL_BALL_COOKIE_NAME)?.value;

  // Login page: redirect to dashboard if already authenticated
  if (pathname === '/') {
    if (token) {
      const user = await getCurrentUser(token);
      if (user) return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // All other routes require auth
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const user = await getCurrentUser(token);
  if (!user) {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.delete(CRYSTAL_BALL_COOKIE_NAME);
    return res;
  }

  // Admin-only page routes
  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Admin-only API routes — return 403 instead of redirect
  if (
    (pathname.startsWith('/api/users') || pathname.startsWith('/api/admin')) &&
    user.role !== 'admin'
  ) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Forward decoded user info to API routes via headers
  const headers = new Headers(req.headers);
  headers.set('x-user-id', user.id);
  headers.set('x-user-email', user.email);
  headers.set('x-user-role', user.role);
  headers.set('x-user-full-name', user.full_name ?? '');

  return NextResponse.next({ request: { headers } });
}
