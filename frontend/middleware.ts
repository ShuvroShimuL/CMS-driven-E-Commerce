import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get('commerce_refresh_token')?.value;
  const path = request.nextUrl.pathname;

  // Protect account routes
  if (path.startsWith('/account')) {
    if (!refreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  // A refresh cookie can outlive the access token. Let users sign in again;
  // redirecting them to /account here causes an endless /login <-> /account loop.

  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/login', '/register'],
};
