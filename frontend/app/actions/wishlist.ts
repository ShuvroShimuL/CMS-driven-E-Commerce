'use server'

import { cookies } from 'next/headers';

const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

function getToken(): string | null {
  return cookies().get('commerce_access_token')?.value || null;
}

export async function getWishlistIds(): Promise<number[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const res = await fetch(`${COMMERCE_API}/wishlist/ids`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.ids || [];
  } catch {
    return [];
  }
}

export async function getWishlistItems() {
  const token = getToken();
  if (!token) return [];

  try {
    const res = await fetch(`${COMMERCE_API}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.items || [];
  } catch {
    return [];
  }
}

export async function toggleWishlist(productStrapiId: number, productSlug: string) {
  const token = getToken();
  if (!token) return { success: false, error: 'Please sign in to save items', action: null };

  try {
    const res = await fetch(`${COMMERCE_API}/wishlist/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ product_strapi_id: productStrapiId, product_slug: productSlug }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || 'Failed', action: null };
    }
    const json = await res.json();
    return { success: true, action: json.action as 'added' | 'removed', error: null };
  } catch {
    return { success: false, error: 'Network error', action: null };
  }
}
