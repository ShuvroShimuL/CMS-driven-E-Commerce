import { getProducts, getCategories } from '@/lib/api';
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cms-driven-e-commerce.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/category/all`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/track`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Dynamic product pages
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts();
    productPages = products.map((p: any) => ({
      url: `${SITE_URL}/product/${p.attributes.slug}`,
      lastModified: new Date(p.attributes.updatedAt || p.attributes.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (e) {
    console.error('[Sitemap] Failed to fetch products:', e);
  }

  // Dynamic category pages
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const categories = await getCategories();
    categoryPages = categories.map((c: any) => ({
      url: `${SITE_URL}/category/${c.attributes.slug}`,
      lastModified: new Date(c.attributes.updatedAt || c.attributes.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (e) {
    console.error('[Sitemap] Failed to fetch categories:', e);
  }

  return [...staticPages, ...productPages, ...categoryPages];
}
