import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * AI crawlers named one by one. `*` already lets them in, but several of
 * them only trust a rule that names them, and listing them documents the
 * choice: the site wants to be read, cited and recommended by LLMs (GEO).
 */
const AI_CRAWLERS = [
  'GPTBot', // OpenAI training
  'OAI-SearchBot', // ChatGPT search
  'ChatGPT-User', // ChatGPT browsing on a user's request
  'ClaudeBot', // Anthropic training
  'Claude-SearchBot', // Claude search
  'Claude-User', // Claude fetching on a user's request
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended', // Gemini
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl, the dataset most open models start from
  'meta-externalagent',
  'Amazonbot',
  'DuckAssistBot',
  'MistralAI-User',
];

/**
 * Everything public is crawlable. The tool routes stay crawlable too: their
 * pages carry `noindex`, which a crawler can only see if it may fetch them.
 * The API has nothing to read and costs a function call per hit.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: '/api/' },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: '/api/' },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
