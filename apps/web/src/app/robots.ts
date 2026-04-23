import type { MetadataRoute } from 'next';
import { absoluteUrl, PUBLIC_SITE_ROUTES } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: PUBLIC_SITE_ROUTES.map((route) => route.href),
      disallow: ['/app', '/app/', '/login', '/register', '/onboarding', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
