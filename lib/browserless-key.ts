/**
 * The Browserless key — client side.
 *
 * A deployment can carry its own token in the environment, and when it does
 * this is never asked for. When it does not, the key is the user's own: it is
 * kept in this browser's local storage, travels with each capture call, and is
 * never stored on the server. Clearing site data clears it, which is the right
 * behaviour for somebody else's billable API key.
 */
const STORAGE_KEY = 'pixel-perfect:browserless-token';

/** The header a capture carries its key in. Matches the API route. */
export const TOKEN_HEADER = 'x-browserless-token';
/** The header that asks for the browser on this machine instead. */
export const LOCAL_HEADER = 'x-capture-local';

/**
 * Local storage cannot be read while rendering on the server, and it fires no
 * event for writes made by this tab — so the key is published as a store the
 * components can subscribe to, and every writer announces itself.
 */
const listeners = new Set<() => void>();

export function subscribeKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(): void {
  for (const listener of listeners) listener();
}

export function loadKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    // Private windows and blocked site data both throw rather than return null
    return null;
  }
}

export function saveKey(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // Nothing to do about it here — the capture will ask again
  }
  announce();
}

export function clearKey(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // As above
  }
  announce();
}

/**
 * Everything a capture call needs to identify itself: the site password when
 * the deployment asks for one, and the Browserless key when the user has one.
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
  const key = loadKey();
  if (key) headers[TOKEN_HEADER] = key;
  return headers;
}
