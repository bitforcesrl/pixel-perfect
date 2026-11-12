'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION, CACHE_PREFIX } from '@/lib/app-version';

/** How often an open tab asks the server which build is live */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
/** Remembers, per tab, which version a forced reload was aiming for */
const RELOAD_TARGET_KEY = 'pp-update-target';

/**
 * Removes every trace of the service worker layer: all registrations and every
 * cache it created. After this, a reload is served straight from the network,
 * so no stale worker or cache can keep the tab on an old build.
 */
async function purgeOfflineLayer() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .map((k) => caches.delete(k)),
    );
  }
}

/** Asks the live deployment for its version; null when offline or failing */
async function fetchLiveVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}

function readReloadTarget(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_TARGET_KEY);
  } catch {
    return null;
  }
}

function writeReloadTarget(version: string | null) {
  try {
    if (version) sessionStorage.setItem(RELOAD_TARGET_KEY, version);
    else sessionStorage.removeItem(RELOAD_TARGET_KEY);
  } catch {
    // Storage blocked: the update still works, only the loop guard is lost
  }
}

/**
 * Smart hook behind the "new version" toast.
 *
 * Detection does not depend on the service worker: the tab compares the
 * version it was built with against `/api/version`. So even a broken or stuck
 * worker cannot hide a new deploy. It checks on load, every 10 minutes, when
 * the tab becomes visible again and when the connection comes back.
 *
 * Applying the update purges the worker and its caches, then reloads, so the
 * next page always comes from the new deploy. A per-tab guard makes sure a
 * misbehaving CDN can never cause a reload loop.
 */
export function useAppUpdate() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    const live = await fetchLiveVersion();
    checking.current = false;
    if (live && live !== APP_VERSION) setAvailableVersion(live);
  }, []);

  useEffect(() => {
    // In development there is no stable build to cache: make sure no worker
    // from an earlier production test keeps serving old files.
    if (process.env.NODE_ENV !== 'production') {
      void purgeOfflineLayer();
      return;
    }

    // Arriving here after an update reload: clear the guard once it worked
    if (readReloadTarget() === APP_VERSION) writeReloadTarget(null);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`, {
          scope: '/',
          updateViaCache: 'none',
        })
        .catch(() => {
          // Offline support is a bonus; the app works without the worker
        });
    }

    // First check right after mount, outside the effect body itself
    const firstCheck = window.setTimeout(check, 0);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [check]);

  const applyUpdate = useCallback(async () => {
    if (!availableVersion) return;
    // Already tried a forced reload for this version in this tab and still
    // got the old build: stop here instead of looping. The next deploy, or
    // a new tab, starts clean.
    if (readReloadTarget() === availableVersion) {
      setDismissedVersion(availableVersion);
      return;
    }
    setIsUpdating(true);
    writeReloadTarget(availableVersion);
    try {
      await purgeOfflineLayer();
    } finally {
      window.location.reload();
    }
  }, [availableVersion]);

  const dismiss = useCallback(() => {
    setDismissedVersion(availableVersion);
  }, [availableVersion]);

  return {
    /** True when a newer deploy is live and the user has not hidden the toast */
    updateAvailable:
      availableVersion !== null && availableVersion !== dismissedVersion,
    isUpdating,
    applyUpdate,
    dismiss,
  };
}
