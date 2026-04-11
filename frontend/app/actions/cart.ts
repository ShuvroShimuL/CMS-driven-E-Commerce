'use server'

import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { fetchAPI } from '@/lib/api';
import { revalidatePath } from 'next/cache';

const COOKIE_NAME = 'cart_session';

/**
 * Gets or creates a local UUID cookie representing the cart session.
 */
export async function getCartSessionId() {
  const cookieStore = cookies();
  const existingCookie = cookieStore.get(COOKIE_NAME);

  if (existingCookie) {
    return existingCookie.value;
  }

  const newSessionId = randomUUID();
  cookieStore.set(COOKIE_NAME, newSessionId, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });

  return newSessionId;
}

/**
 * Fetches the raw Cart object from Strapi based on UUID.
 */
export async function getCart() {
  const sessionId = await getCartSessionId();

  const response = await fetchAPI('/carts', {
    'filters[sessionId][$eq]': sessionId
  });

  if (response.data && response.data.length > 0) {
    return response.data[0];
  }

  // If no cart exists in DB for this UUID, create an empty one
  const newCart = await fetchAPI('/carts', {}, {
    method: 'POST',
    body: {
      data: {
        sessionId,
        cartItems: []
      }
    }
  });

  return newCart.data;
}

/**
 * Add product to cart. 
 */
export async function addToCart(productData: any) {
  const cart = await getCart();
  const currentItems = cart.attributes.cartItems || [];

  const existingItemIndex = currentItems.findIndex((item: any) => item.id === productData.id);

  if (existingItemIndex > -1) {
    currentItems[existingItemIndex].quantity += 1;
  } else {
    currentItems.push({
      id: productData.id,
      slug: productData.slug,
      title: productData.title,
      price: productData.price,
      quantity: 1,
      image: productData.image
    });
  }

  // Update Strapi Cart
  await fetchAPI(`/carts/${cart.id}`, {}, {
    method: 'PUT',
    body: {
      data: {
        cartItems: currentItems
      }
    }
  });

  revalidatePath('/cart');
  return { success: true };
}

/**
 * Reset Cart after checkout
 */
export async function clearCart() {
  const cart = await getCart();
  await fetchAPI(`/carts/${cart.id}`, {}, {
    method: 'PUT',
    body: {
      data: {
        cartItems: []
      }
    }
  });
  
  revalidatePath('/cart');
}
