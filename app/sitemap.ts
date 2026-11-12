import type { MetadataRoute } from 'next';
import { DOCS_PATH } from '@/lib/docs';
import { SITE } from '@/lib/site';

/**
 * The public pages, on the production domain.
 *
 * The sitemap is rendered once per build, so `lastModified` is the time of the
 * deploy that published these pages: every deploy tells crawlers the content
 * may have changed and is worth a fresh visit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE.url}${DOCS_PATH}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
