import type { MetadataRoute } from 'next';
import { DOCS_PATH } from '@/lib/docs';
import { SITE } from '@/lib/site';

/** The public pages, on the production domain. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE.url}${DOCS_PATH}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
