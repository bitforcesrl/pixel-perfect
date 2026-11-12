/**
 * Pixel Perfect service worker.
 *
 * Design rule: this worker must never be able to pin a user to an old build.
 *  - Pages (navigations) are network-first: online, the user always gets the
 *    HTML of the latest deploy; the cache is only an offline fallback.
 *  - Only `/_next/static/*` is cache-first. Those files are content-hashed, so
 *    a cached copy can never be the wrong version of a file.
 *  - API routes and the worker itself are never cached.
 *  - Each deploy registers this file with a new `?v=` query, so the browser
 *    installs a fresh worker, and on activation every older cache is deleted.
 *  - The page can always escape: the update toast unregisters the worker and
 *    clears all caches before reloading (see useAppUpdate.ts).
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'pp-';
const CACHE = CACHE_PREFIX + VERSION;
const OFFLINE_FALLBACK = '/app';

self.addEventListener('install', () => {
  // Nothing is precached: the first online visit fills the cache as it goes.
  // Activating straight away is safe because pages are network-first.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Network first, falling back to the cache when offline */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) ||
      (request.mode === 'navigate' && (await cache.match(OFFLINE_FALLBACK)));
    if (cached) return cached;
    throw error;
  }
}

/** Cache first, for immutable content-hashed build files only */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
