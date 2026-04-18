import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cms-driven-e-commerce.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/checkout', '/order-success', '/verify-otp', '/reset-password', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
