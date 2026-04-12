'use server'

import { cookies } from 'next/headers';

const COMMERCE_API   = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';
const ACCESS_COOKIE  = 'commerce_access_token';
const REFRESH_COOKIE = 'commerce_refresh_token';
const USER_COOKIE    = 'auth_user';
const CART_COOKIE    = 'cart_session';

// ─── Cookie helpers ───────────────────────────────────────────────────────────
function setAuthCookies(accessToken: string, refreshToken: string, user: any) {
  const store = cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 15,              // 15 min
    path: '/', sameSite: 'lax'
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,    // 7 days
    path: '/', sameSite: 'lax'
  });
  // non-httpOnly so header server component can read it without an extra API call
  store.set(USER_COOKIE, JSON.stringify({ id: user.id, email: user.email, full_name: user.full_name }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/', sameSite: 'lax'
  });
}

// ─── Session helpers (used by Server Components) ──────────────────────────────
export async function getSession(): Promise<{ id: number; email: string; full_name: string } | null> {
  const cookie = cookies().get(USER_COOKIE);
  if (!cookie) return null;
  try { return JSON.parse(cookie.value); }
  catch { return null; }
}

export async function getAccessToken(): Promise<string | null> {
  return cookies().get(ACCESS_COOKIE)?.value || null;
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerUser(formData: FormData) {
  const data = {
    email:     formData.get('email')     as string,
    password:  formData.get('password')  as string,
    full_name: formData.get('full_name') as string,
    phone:     formData.get('phone')     as string,
  };
  try {
    const res  = await fetch(`${COMMERCE_API}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || 'Registration failed' };
    return { success: true, email: data.email };
  } catch {
    return { success: false, error: 'Unable to connect to server. Please try again.' };
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export async function verifyOTP(formData: FormData) {
  const email = formData.get('email') as string;
  const otp   = formData.get('otp')   as string;
  try {
    const res  = await fetch(`${COMMERCE_API}/users/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || 'OTP verification failed' };
    setAuthCookies(json.accessToken, json.refreshToken, json.user);
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to connect to server.' };
  }
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────
export async function resendOTP(email: string) {
  try {
    const res  = await fetch(`${COMMERCE_API}/users/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    return { success: res.ok, error: json.error };
  } catch {
    return { success: false, error: 'Unable to connect to server.' };
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginUser(formData: FormData) {
  const email    = formData.get('email')    as string;
  const password = formData.get('password') as string;
  try {
    const res  = await fetch(`${COMMERCE_API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();

    if (!res.ok) {
      if (json.needsVerification)
        return { success: false, needsVerification: true, email: json.email, error: json.error };
      return { success: false, error: json.error || 'Login failed' };
    }

    setAuthCookies(json.accessToken, json.refreshToken, json.user);

    // Merge guest cart on login
    const guestSessionId = cookies().get(CART_COOKIE)?.value;
    if (guestSessionId) {
      try {
        const mergeRes = await fetch(`${COMMERCE_API}/users/merge-cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${json.accessToken}` },
          body: JSON.stringify({ guestSessionId })
        });
        if (mergeRes.ok) {
          const { newSessionId } = await mergeRes.json();
          if (newSessionId) {
            cookies().set(CART_COOKIE, newSessionId, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              maxAge: 60 * 60 * 24 * 30,
              path: '/', sameSite: 'lax'
            });
          }
        }
      } catch (e) { console.error('[Auth] Cart merge failed:', e); }
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Unable to connect to server.' };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logoutUser() {
  const store       = cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      await fetch(`${COMMERCE_API}/users/logout`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch {}
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(USER_COOKIE);
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
export async function forgotPassword(formData: FormData) {
  const email = formData.get('email') as string;
  try {
    await fetch(`${COMMERCE_API}/users/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  } catch {}
  // Always succeed — prevents email enumeration
  return { success: true };
}

// ─── Reset Password ───────────────────────────────────────────────────────────
export async function resetPassword(formData: FormData) {
  const data = {
    token:       formData.get('token')       as string,
    newPassword: formData.get('newPassword') as string,
  };
  try {
    const res  = await fetch(`${COMMERCE_API}/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || 'Password reset failed' };
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to connect to server.' };
  }
}
