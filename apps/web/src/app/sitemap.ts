import type { MetadataRoute } from 'next';
import { absoluteUrl, PUBLIC_SITE_ROUTES } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SITE_ROUTES.map((route) => ({
    url: absoluteUrl(route.href),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
