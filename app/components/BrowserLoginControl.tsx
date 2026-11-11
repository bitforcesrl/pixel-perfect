'use client';

import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/gate';

type Status = {
  available: boolean;
  saved: boolean;
  savedAt: number | null;
  open: boolean;
};

const ACTION =
  'rounded border border-ink-700 px-2 py-1 text-[10px] text-ink-100 transition-colors hover:border-press-violet hover:text-press-violet disabled:cursor-default disabled:opacity-40';

/** How often an open window is checked on, to notice it being closed. */
const POLL_MS = 2_000;

function formatSavedAt(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchStatus(target: string): Promise<Status | null> {
  try {
    const res = await fetch(
      `/api/login-session?url=${encodeURIComponent(target)}`,
      { cache: 'no-store', headers: await authHeaders() },
    );
    return res.ok ? ((await res.json()) as Status) : null;
  } catch {
    // Offline: keep showing what was last known
    return null;
  }
}

/**
 * Log into the page's site by hand, for captures to reuse.
 *
 * For logins a script cannot do — a code sent by email. "Log in" opens a
 * Firefox window on this machine; once logged in there, "Done" (or closing the
 * window) saves the session for the site's host, and every local capture of
 * that host starts from it. Shown only where that window can actually open.
 */
export default function BrowserLoginControl({ url }: { url: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = url.trim();
  const open = status?.open === true;

  // An empty URL is asked about too: the answer is "nothing saved", which is
  // what clears a status left over from the URL before it
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await fetchStatus(target);
      if (!cancelled && next) setStatus(next);
    };
    void check();
    // While the window is open, notice it being closed from the window itself
    const timer = open ? setInterval(() => void check(), POLL_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [target, open]);

  if (!status?.available) return null;

  const send = async (init: RequestInit, query = '') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/login-session${query}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(await authHeaders()),
        },
      });
      const data = (await res.json()) as Partial<Status> & { error?: string };
      if (!res.ok) setError(data.error ?? 'Something went wrong');
      else setStatus((prev) => ({ ...(prev as Status), ...data }));
    } catch {
      setError('Could not reach the app server');
    } finally {
      setBusy(false);
    }
  };

  const post = (action: 'open' | 'done') =>
    send({ method: 'POST', body: JSON.stringify({ url: target, action }) });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-[0.12em] text-press-cyan uppercase">
        Browser login
      </span>
      <span className="text-[10px] text-ink-500">
        {status.open
          ? 'Log in in the Firefox window, then press Done.'
          : status.saved && status.savedAt !== null
            ? `Session saved ${formatSavedAt(status.savedAt)} — local captures use it.`
            : 'For sites that need a login (e.g. a code by email).'}
      </span>
      <div className="flex items-center gap-1">
        {status.open ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post('done')}
            className={ACTION}
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || target === ''}
            onClick={() => void post('open')}
            className={ACTION}
          >
            {status.saved ? 'Log in again' : 'Log in'}
          </button>
        )}
        {(status.saved || status.open) && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void send(
                { method: 'DELETE' },
                `?url=${encodeURIComponent(target)}`,
              )
            }
            className={ACTION}
          >
            Forget
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-press-red">{error}</span>}
    </div>
  );
}
