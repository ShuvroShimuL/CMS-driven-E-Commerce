'use server'

import { cookies } from 'next/headers';

const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

export async function submitReview(productId: number, productSlug: string, rating: number, comment: string) {
  const token = cookies().get('commerce_access_token')?.value;
  if (!token) return { success: false, error: 'Please log in to submit a review' };
  try {
    const response = await fetch(`${COMMERCE_API}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId, productSlug, rating, comment }),
    });
    const data = await response.json();
    return { success: response.ok && data.success === true, error: data.error };
  } catch {
    return { success: false, error: 'Network error — please try again' };
  }
}
