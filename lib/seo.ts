import type { Metadata } from 'next';
import { APP_VERSION } from './version';
import { DOCS_PATH } from './docs';
import { SITE } from './site';

/**
 * Search, social and AI-crawler metadata, kept in one place so every page
 * describes the project the same way.
 */

/** Search terms people actually type when looking for a tool like this */
export const KEYWORDS = [
  'pixel perfect',
  'design QA',
  'Figma comparison',
  'Figma vs website',
  'visual regression',
  'screenshot diff',
  'overlay Figma design',
  'frontend QA tool',
  'open source',
];

/**
 * Open Graph fields every page shares. Next replaces `openGraph` as a whole
 * when a page sets it, so pages spread this in instead of losing them.
 */
/**
 * The share card rendered by `app/opengraph-image.tsx`, named explicitly:
 * a page that sets its own `openGraph` would otherwise drop it.
 */
export const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${SITE.name}: ${SITE.tagline}`,
};

export const OPEN_GRAPH_BASE = {
  type: 'website',
  siteName: SITE.name,
  locale: 'en_US',
  images: [SHARE_IMAGE],
} as const satisfies Metadata['openGraph'];

/** Hides a route from search results without hiding its links from crawlers */
export const NO_INDEX: Metadata['robots'] = { index: false, follow: true };

/* ── Structured data (schema.org, read by Google and by LLM crawlers) ─── */

/** The author named in the LICENSE */
const publisher = { '@type': 'Person', name: SITE.author };

/** The landing page: what the product is, what it costs, where the code is */
export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: 'en',
        publisher,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE.url}/#app`,
        name: SITE.name,
        description: SITE.description,
        url: SITE.url,
        applicationCategory: 'DesignApplication',
        applicationSubCategory: 'Design QA',
        operatingSystem: 'Web browser',
        softwareVersion: APP_VERSION,
        isAccessibleForFree: true,
        license: 'https://opensource.org/licenses/MIT',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        image: `${SITE.url}/opengraph-image`,
        sameAs: [SITE.githubUrl],
        publisher,
      },
      {
        '@type': 'SoftwareSourceCode',
        name: SITE.name,
        codeRepository: SITE.githubUrl,
        programmingLanguage: 'TypeScript',
        license: 'https://opensource.org/licenses/MIT',
      },
    ],
  };
}

/** The documentation page, as a technical article about the app */
export function docsJsonLd(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${SITE.name} documentation`,
    description,
    url: `${SITE.url}${DOCS_PATH}`,
    inLanguage: 'en',
    about: { '@id': `${SITE.url}/#app` },
    publisher,
  };
}
