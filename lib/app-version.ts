/**
 * The version of the build this code belongs to.
 *
 * It is inlined at build time (see `env` in next.config.ts), so the browser
 * bundle and the server of the same deployment always carry the same value,
 * and every deploy produces a new one. Comparing the two is how a running tab
 * finds out that a newer deploy is live.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

/** Prefix shared by every cache the service worker creates */
export const CACHE_PREFIX = 'pp-';
