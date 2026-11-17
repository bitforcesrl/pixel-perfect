/**
 * Where the Pixel Perfect app runs, as far as the extension is concerned.
 *
 * The bridge is injected on these origins only, and only pages on them may ask
 * for a capture. More origins (a self-hosted copy, a preview deployment) are
 * added by the user in the options page.
 */

export const DEFAULT_APP_MATCHES = [
  'https://pixelperfect.fit/*',
  'https://www.pixelperfect.fit/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
];

/** Where "Open in Pixel Perfect" goes when no app tab is open. */
export const DEFAULT_APP_URL = 'https://pixelperfect.fit/app';

export function isDefaultAppOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === 'http:') {
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  }
  if (url.protocol === 'https:') {
    return (
      url.hostname === 'pixelperfect.fit' ||
      url.hostname === 'www.pixelperfect.fit'
    );
  }
  return false;
}

/** The match pattern that covers every page of `origin`. */
export function matchPatternFor(origin) {
  return `${new URL(origin).origin}/*`;
}
