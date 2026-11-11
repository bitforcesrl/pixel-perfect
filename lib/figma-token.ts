
/**
 * The Figma token — client side.
 *
 * Same terms as the Browserless key: a deployment with `FIGMA_TOKEN` of its own
 * never asks for this. Without one, the token is the user's personal access
 * token, kept in this browser's local storage, sent with each export call and
 * never stored on the server.
 */
const STORAGE_KEY = 'pixel-perfect:figma-token';

/** The header an export carries its token in. Matches the API route. */
export const FIGMA_TOKEN_HEADER = 'x-figma-token';

const listeners = new Set<() => void>();

export function subscribeFigmaToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(): void {
  for (const listener of listeners) listener();
}

export function loadFigmaToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    // Private windows and blocked site data both throw rather than return null
    return null;
  }
}

export function saveFigmaToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    // Nothing to do about it here — the export will ask again
  }
  announce();
}

export function clearFigmaToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // As above
  }
  announce();
}

/** JSON headers, plus the Figma token when one is stored. */
export async function figmaHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = loadFigmaToken();
  if (token) headers[FIGMA_TOKEN_HEADER] = token;
  return headers;
}
