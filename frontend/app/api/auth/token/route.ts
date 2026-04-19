import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/token
 * Proxies the httpOnly access token to client components that need
 * to make authenticated API calls (e.g. ReviewSection).
 * Only returns the token to same-origin requests.
 */
export async function GET() {
  const token = cookies().get('commerce_access_token')?.value;
  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token });
}
