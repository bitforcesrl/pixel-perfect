/**
 * The Browserless key — client side.
 *
 * A deployment can carry its own token in the environment (`BROWSERLESS_TOKEN`,
 * the usual setup on a developer's machine), and when it does this is never
 * asked for. When it does not — a public deployment such as Vercel — the key is
 * the user's own: each visitor brings their own browserless.io account. It is
 * kept in this browser's IndexedDB among the app's settings, travels with each
 * capture call, and is never stored on the server.
 *
 * IndexedDB is asynchronous but the UI needs a synchronous answer while it
 * renders, so the key is mirrored in memory: {@link loadKey} reads the mirror,
 * {@link ensureKeyLoaded} fills it from the database once, and every writer
 * updates both and announces itself to subscribers.
 */
import {
  clearBrowserlessKey,
  loadBrowserlessKey,
  saveBrowserlessKey,
} from './storage';

/**
 * Where earlier versions kept the key. Read once to migrate it into IndexedDB,
 * so a user who had already typed theirs in is not asked again.
 */
const LEGACY_STORAGE_KEY = 'pixel-perfect:browserless-token';

/** The header a capture carries its key in. Matches the API route. */
export const TOKEN_HEADER = 'x-browserless-token';
/** The header that asks for the browser on this machine instead. */
export const LOCAL_HEADER = 'x-capture-local';

/** The in-memory mirror of the stored key. */
let cached: string | null = null;
/** The one database read, shared by everyone who asks before it settles. */
let hydration: Promise<string | null> | null = null;
/** The user saved or removed a key in this tab — the mirror is authoritative. */
let touched = false;

const listeners = new Set<() => void>();

export function subscribeKey(listener: () => void): () => void {
  listeners.add(listener);
  // The first subscriber starts the read, so the menu checkmark and the status
  // bar are right without anyone having to open the dialog first
  void ensureKeyLoaded();
  return () => listeners.delete(listener);
}

function announce(): void {
  for (const listener of listeners) listener();
}

function readLegacyKey(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_STORAGE_KEY)?.trim() || null;
  } catch {
    // Private windows and blocked site data both throw rather than return null
    return null;
  }
}

function dropLegacyKey(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing more to do: the key is already safe in IndexedDB
  }
}

async function hydrate(): Promise<string | null> {
  let stored: string | null = null;
  try {
    stored = await loadBrowserlessKey();
  } catch (err) {
    // No IndexedDB (blocked site data, very old browser): the user can still
    // type a key in, it just lasts for this session only
    console.warn('pixel-perfect: could not read the Browserless key', err);
  }

  const legacy = readLegacyKey();
  if (stored === null && legacy !== null) {
    stored = legacy;
    try {
      await saveBrowserlessKey(legacy);
      // Only dropped once the copy is written, so a failed move loses nothing
      dropLegacyKey();
    } catch (err) {
      console.warn('pixel-perfect: could not migrate the Browserless key', err);
    }
  } else if (legacy !== null) {
    // Both exist: the database is the newer one
    dropLegacyKey();
  }

  // A save or remove made while the read was in flight is newer than what
  // was read
  if (!touched) cached = stored;
  announce();
  return cached;
}

/**
 * The stored key, read from IndexedDB on the first call and from memory after.
 * Never rejects: a database that cannot be read means no key.
 */
export function ensureKeyLoaded(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  hydration ??= hydrate();
  return hydration.then(() => cached);
}

/** The key as far as this tab knows — null until {@link ensureKeyLoaded} settles. */
export function loadKey(): string | null {
  return cached;
}

/**
 * Keep a key. It is usable at once even if the database write fails — the
 * promise rejects so the dialog can say it will not survive a reload.
 */
export async function saveKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed === '') return;
  touched = true;
  cached = trimmed;
  announce();
  await saveBrowserlessKey(trimmed);
}

/** Forget the key, in memory at once and in the database. */
export async function clearKey(): Promise<void> {
  touched = true;
  cached = null;
  announce();
  dropLegacyKey();
  await clearBrowserlessKey();
}

/**
 * Everything a capture call needs to identify itself: the local-browser flag,
 * or the Browserless key when the user has one.
 */
export async function captureHeaders(
  opts: { local?: boolean } = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.local) {
    // A local capture wants this machine's browser, whatever key is stored
    headers[LOCAL_HEADER] = '1';
    return headers;
  }
  const key = await ensureKeyLoaded();
  if (key) headers[TOKEN_HEADER] = key;
  return headers;
}
