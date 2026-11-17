/**
 * The messages the app and the extension exchange.
 *
 * Page ⇄ bridge: `window.postMessage` objects tagged with `source`.
 * Bridge ⇄ service worker: a `chrome.runtime` Port named {@link PORT_NAME}.
 *
 * From the app: `hello`, `capture`, `cancel`, `incoming-request` (send me a
 * site that arrived before I was listening), `incoming-ack`.
 * From the extension: `hello-reply`, `progress`, `result` (`result-chunk` on
 * the Port, reassembled by the bridge), `error`, `done`, `rejected` (the
 * request never ran), `incoming` (a site sent from the toolbar).
 * Bridge → service worker only: `ready` (collect a site waiting for this tab).
 */

export const APP_SOURCE = 'pixel-perfect-app';
export const EXT_SOURCE = 'pixel-perfect-extension';
export const PORT_NAME = 'pp-bridge';

/** Same bounds as the app's own capture request (`lib/validation.ts`). */
export const MIN_DIM = 200;
export const MAX_DIM = 4000;
export const MAX_VIEWPORTS = 12;
const MAX_KEY_LENGTH = 64;

/** Pages an extension may not, or must not, drive. */
const BLOCKED_HOSTS = ['chromewebstore.google.com'];
const BLOCKED_PREFIXES = ['https://chrome.google.com/webstore'];

/** Why `url` cannot be captured, or null when it can. */
export function refuseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'Not a valid address';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http and https pages can be captured';
  }
  if (
    BLOCKED_HOSTS.includes(parsed.hostname) ||
    BLOCKED_PREFIXES.some((prefix) => parsed.href.startsWith(prefix))
  ) {
    return 'Chrome does not let extensions capture the Web Store';
  }
  return null;
}

const isDimension = (value) =>
  Number.isInteger(value) && value >= MIN_DIM && value <= MAX_DIM;

const isViewport = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.key === 'string' &&
  value.key.length > 0 &&
  value.key.length <= MAX_KEY_LENGTH &&
  isDimension(value.width) &&
  isDimension(value.height);

/** Validate a `capture` message from a page. */
export function parseCaptureRequest(message) {
  if (message === null || typeof message !== 'object') {
    return { ok: false, error: 'Malformed request' };
  }
  const { requestId, url, viewports } = message;
  if (typeof requestId !== 'string' || requestId.length === 0) {
    return { ok: false, error: 'Missing request id' };
  }
  if (typeof url !== 'string') return { ok: false, error: 'Missing url' };
  const refused = refuseUrl(url);
  if (refused) return { ok: false, error: refused };
  if (
    !Array.isArray(viewports) ||
    viewports.length === 0 ||
    viewports.length > MAX_VIEWPORTS ||
    !viewports.every(isViewport)
  ) {
    return { ok: false, error: 'Invalid viewports' };
  }
  return {
    ok: true,
    value: {
      requestId,
      url,
      viewports: viewports.map(({ key, width, height }) => ({
        key,
        width,
        height,
      })),
    },
  };
}
