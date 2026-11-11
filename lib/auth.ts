/**
 * Site password — server side.
 *
 * The password lives in `SITE_PASSWORD` and is only ever compared here, on the
 * server: the client keeps its copy in IndexedDB and sends it back to be
 * checked, so the password itself never ships in the bundle.
 *
 * Unset (or empty) `SITE_PASSWORD` means no gate at all — that is the local
 * default. Set it on a deployment to close it.
 */

export const PASSWORD_HEADER = 'x-site-password';

const encoder = new TextEncoder();

export function sitePassword(): string | undefined {
  const value = process.env.SITE_PASSWORD;
  return value ? value : undefined;
}

export function isGateEnabled(): boolean {
  return sitePassword() !== undefined;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );
  return new Uint8Array(signature);
}

/** Constant-time byte compare — both digests are fixed width, so no early out. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Compares two strings without leaking their length or first differing byte:
 * both are run through an HMAC keyed with fresh random bytes, so the compare
 * always happens over 32 bytes an attacker cannot precompute.
 */
async function equalSecrets(a: string, b: string): Promise<boolean> {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const [digestA, digestB] = await Promise.all([hmac(key, a), hmac(key, b)]);
  return equalBytes(digestA, digestB);
}

/** True when the gate is off, or when `input` is the configured password. */
export async function verifyPassword(input: string): Promise<boolean> {
  const password = sitePassword();
  if (password === undefined) return true;
  if (!input) return false;
  return equalSecrets(input, password);
}

/** Checks the password a request carries in the `x-site-password` header. */
export function verifyRequest(request: Request): Promise<boolean> {
  return verifyPassword(request.headers.get(PASSWORD_HEADER) ?? '');
}
