/**
 * lib/api.ts
 * Helper layer to interact with Strapi seamlessly using Next.js caching standard.
 */

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN;

/**
 * Global fetch wrapper utilizing Strapi authorization.
 * Defaults to 1 hour cache (3600), typical for ISR pages.
 */
export async function fetchAPI(
  path: string, 
  urlParamsObject = {}, 
  options: { revalidate?: number; method?: string; body?: any; cache?: RequestCache; auth?: boolean } = {}
) {
  try {
    const queryString = new URLSearchParams(urlParamsObject).toString();
    const requestUrl = `${API_URL}/api${path}${queryString ? `?${queryString}` : ''}`;
    
    // By default use token, unless explicitly disabled
    const useAuth = options.auth !== false;

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(useAuth && API_TOKEN && { Authorization: `Bearer ${API_TOKEN}` }),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    if (options.cache) {
      fetchOptions.cache = options.cache;
    } else {
      fetchOptions.next = { revalidate: options.revalidate !== undefined ? options.revalidate : 3600 };
    }

    const response = await fetch(requestUrl, fetchOptions);

    // Check if empty response (e.g. 204 status without body)
    if (response.status === 204) return null;

    const data = await response.json();

    if (!response.ok) {
      console.error(`Strapi API Error (${response.status}):`, data);
      throw new Error(`An error occurred please try again`);
    }

    return data;
  } catch (error) {
    console.error(`fetchAPI Error on /api${path}:`, error);
    throw error;
  }
}

// Convenience helpers
export async function getProducts(params = {}) {
  // Ensure we get related data like images by default
  const defaultParams = { populate: 'images,category' };
  const res = await fetchAPI('/products', { ...defaultParams, ...params });
  return res.data || [];
}

export async function getProductBySlug(slug: string) {
  // Use Strapi's array filter notation
  const res = await fetchAPI('/products', {
    'filters[slug][$eq]': slug,
    populate: 'images,category'
  });
  return res.data?.[0] || null;
}

export async function getCategories(params = {}) {
  const res = await fetchAPI('/categories', params);
  return res.data || [];
}

export async function getCategoryBySlug(slug: string) {
  const res = await fetchAPI('/categories', {
    'filters[slug][$eq]': slug,
    populate: 'products,products.images'
  });
  return res.data?.[0] || null;
}
