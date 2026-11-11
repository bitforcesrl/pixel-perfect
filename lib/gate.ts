import { PASSWORD_HEADER } from './auth';
import { clearPassword, loadPassword, savePassword } from './storage';

/**
 * Site password — client side.
 *
 * The password is held in IndexedDB, and mirrored here in memory so the API
 * calls that need it do not each wait on a database read. It is only ever
 * *checked* by the server, so nothing here decides whether the app opens.
 */
let cached: string | null = null;

/** Does this deployment want a password? Unset on the server means no. */
export async function isGateRequired(): Promise<boolean> {
  const res = await fetch('/api/auth', { cache: 'no-store' });
  if (!res.ok) return true;
  const data = (await res.json()) as { required?: unknown };
  return data.required === true;
}

/** Asks the server whether `password` is the right one. */
export async function checkPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function rememberPassword(password: string): Promise<void> {
  cached = password;
  await savePassword(password);
}

export async function readPassword(): Promise<string | null> {
  if (cached !== null) return cached;
  cached = await loadPassword();
  return cached;
}

/** Called when the server rejects what we stored — the password changed. */
export async function forgetPassword(): Promise<void> {
  cached = null;
  await clearPassword();
}

/** The header every gated API call carries. Empty when there is no password. */
export async function authHeaders(): Promise<Record<string, string>> {
  const password = await readPassword();
  return password ? { [PASSWORD_HEADER]: password } : {};
}
