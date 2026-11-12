/**
 * How full this browser's storage is, watched so the user hears about it
 * before a capture silently fails to save.
 *
 * Everything the app keeps lives in IndexedDB on this machine, inside a quota
 * the browser decides (a share of the free disk, which on Safari can be far
 * smaller than on Chrome). Past it every write is refused. Storage writes
 * report in here: a successful one asks for a fresh estimate (throttled), a
 * refused one flags the store as full at once. Browser only; on a browser
 * without `navigator.storage.estimate` the level simply stays unknown.
 */

export type QuotaLevel = 'ok' | 'high' | 'full';

export interface StorageQuota {
  /** Bytes this site uses */
  usage: number;
  /** Bytes the browser lets it use */
  quota: number;
  level: QuotaLevel;
}

/**
 * Warn from this share of the quota. 80% leaves room for a few more full-page
 * captures, enough to export a project before anything is refused.
 */
export const QUOTA_WARN_RATIO = 0.8;

/**
 * ...or from this little room left, whatever the share: one tall 2x capture
 * with its Figma export and a snapshot runs to tens of megabytes, and a small
 * quota can hit the wall well before 80%.
 */
export const QUOTA_MIN_FREE_BYTES = 150 * 1024 * 1024;

/** At most one estimate per this many ms — writes come in bursts. */
const CHECK_INTERVAL_MS = 5_000;

let current: StorageQuota | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let lastCheck = 0;

function emit(next: StorageQuota | null): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Where `usage` of `quota` puts the store. Pure, for the banner and tests. */
export function quotaLevel(usage: number, quota: number): QuotaLevel {
  if (!(quota > 0)) return 'ok';
  if (usage >= quota) return 'full';
  if (usage / quota >= QUOTA_WARN_RATIO) return 'high';
  if (quota - usage <= QUOTA_MIN_FREE_BYTES) return 'high';
  return 'ok';
}

/** Ask the browser now. Resolves null when it cannot say. */
export async function checkStorageQuota(): Promise<StorageQuota | null> {
  lastCheck = Date.now();
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    // A refusal already seen stays "full" until usage really drops below
    // the quota: the estimate lags behind what the browser just refused
    const level =
      current?.level === 'full' && usage >= quota * QUOTA_WARN_RATIO
        ? 'full'
        : quotaLevel(usage, quota);
    const next = { usage, quota, level };
    emit(next);
    return next;
  } catch (err) {
    console.warn('pixel-perfect: storage estimate unavailable', err);
    return null;
  }
}

/** A write went through: re-estimate soon, without one estimate per write. */
export function requestQuotaCheck(): void {
  if (timer !== null) return;
  const wait = Math.max(0, CHECK_INTERVAL_MS - (Date.now() - lastCheck));
  timer = setTimeout(() => {
    timer = null;
    void checkStorageQuota();
  }, wait);
}

/** Whether `err` is the browser refusing a write for lack of room. */
export function isQuotaError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'QuotaExceededError'
  );
}

/** A write was refused for lack of room: say so now, then measure. */
export function reportQuotaExceeded(): void {
  emit({
    usage: current?.usage ?? 0,
    quota: current?.quota ?? 0,
    level: 'full',
  });
  requestQuotaCheck();
}

export function subscribeQuota(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQuota(): StorageQuota | null {
  return current;
}

/** "1.4 GB", "820 MB" — a size the way a person reads one. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(mb))} MB`;
}
