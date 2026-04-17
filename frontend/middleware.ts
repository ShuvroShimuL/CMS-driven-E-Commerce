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

  // Prevent logged-in users from seeing login/register pages
  if ((path === '/login' || path === '/register') && refreshToken) {
    return NextResponse.redirect(new URL('/account', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/login', '/register'],
};
