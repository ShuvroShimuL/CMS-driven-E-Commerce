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
  return existingCookie ? existingCookie.value : null;
}

/**
 * Fetches the raw Cart object from Strapi based on UUID.
 */
export async function getCart() {
  const sessionId = await getCartSessionId();
  if (!sessionId) return null;

  const response = await fetchAPI('/carts', {
    'filters[sessionId][$eq]': sessionId
  }, { auth: false, cache: 'no-store' });

  if (response?.data && response.data.length > 0) {
    return response.data[0];
  }

  return null;
}

/**
 * Add product to cart. 
 */
export async function addToCart(productData: any) {
  let cart = await getCart();
  let sessionId = await getCartSessionId();

  // If no session, create one (this is a Server Action so cookies().set is allowed)
  if (!sessionId) {
    sessionId = randomUUID();
    cookies().set(COOKIE_NAME, sessionId, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });
  }

  // If no cart, create it in Strapi
  if (!cart) {
    const newCartRes = await fetchAPI('/carts', {}, {
      method: 'POST',
      auth: false,
      cache: 'no-store',
      body: {
        data: {
          sessionId,
          cartItems: []
        }
      }
    });
    cart = newCartRes.data;
  }

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
    auth: false,
    cache: 'no-store',
    body: {
      data: {
        cartItems: currentItems
      }
    }
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Reset Cart after checkout
 */
export async function clearCart() {
  const cart = await getCart();
  if (!cart) return;

  await fetchAPI(`/carts/${cart.id}`, {}, {
    method: 'PUT',
    auth: false,
    cache: 'no-store',
    body: {
      data: {
        cartItems: []
      }
    }
  });
  
  revalidatePath('/', 'layout');
}

/**
 * Update quantity of a specific cart item.
 * If quantity <= 0, removes the item.
 */
export async function updateCartItemQuantity(productId: number, newQuantity: number) {
  const cart = await getCart();
  if (!cart) return { success: false, error: 'Cart not found' };

  let currentItems = cart.attributes.cartItems || [];

  if (newQuantity <= 0) {
    currentItems = currentItems.filter((item: any) => item.id !== productId);
  } else {
    const idx = currentItems.findIndex((item: any) => item.id === productId);
    if (idx === -1) return { success: false, error: 'Item not in cart' };
    currentItems[idx].quantity = newQuantity;
  }

  await fetchAPI(`/carts/${cart.id}`, {}, {
    method: 'PUT',
    auth: false,
    cache: 'no-store',
    body: { data: { cartItems: currentItems } }
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Remove a specific item from the cart entirely.
 */
export async function removeCartItem(productId: number) {
  return updateCartItemQuantity(productId, 0);
}
