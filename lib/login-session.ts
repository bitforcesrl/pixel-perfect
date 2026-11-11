import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext } from 'playwright';

/**
 * A login done by hand, kept for the captures that follow.
 *
 * Some sites cannot be got into by a script at all — a one-time code sent by
 * email is the usual case. So a visible Firefox window opens on this machine,
 * the person logs in there the way they always do, and what the site handed
 * out (cookies, localStorage, IndexedDB) is written to disk per host. Every
 * local capture of that host then opens its context from that file, already
 * logged in.
 *
 * sessionStorage is not part of it: a site that keeps its login only there
 * forgets it as soon as the window closes, for a person as much as for this.
 */

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

type LoginWindow = {
  browser: Browser;
  context: BrowserContext;
  /**
   * What the window held when last looked at, for when it is closed and can
   * no longer be asked: cookies, and localStorage by origin.
   */
  latest: StorageState;
  timer: ReturnType<typeof setInterval>;
  finishing: Promise<void> | null;
};

/** Open windows by host. On `globalThis` so a dev-server reload keeps them. */
const store = globalThis as unknown as {
  __ppLoginWindows?: Map<string, LoginWindow>;
};
const windows = (store.__ppLoginWindows ??= new Map());

/** How often the open window's state is read, so closing it loses nothing. */
const SNAPSHOT_MS = 2_000;

/**
 * The cheap read, taken while the person is logging in.
 *
 * Not `context.storageState()`: for every origin visited that is not on screen
 * it opens a page of its own and navigates it there, which in a visible window
 * every two seconds is a tab flashing open and shut over the login form. The
 * cookies come from the browser without touching any page, and localStorage is
 * read from the page that is already open, kept per origin as the login moves
 * between domains.
 */
async function quickSnapshot(context: BrowserContext, previous: StorageState) {
  const origins = new Map(previous.origins.map((o) => [o.origin, o]));
  for (const page of context.pages()) {
    const entry = await page
      .evaluate(() => ({
        origin: location.origin,
        localStorage: Object.keys(localStorage).map((name) => ({
          name,
          value: localStorage.getItem(name) ?? '',
        })),
      }))
      .catch(() => null);
    if (!entry || !entry.origin.startsWith('http')) continue;
    origins.set(entry.origin, { ...origins.get(entry.origin), ...entry });
  }
  return {
    cookies: await context.cookies(),
    origins: [...origins.values()],
  } as StorageState;
}

function sessionsDir(): string {
  return path.join(process.cwd(), '.sessions');
}

/** The host the session belongs to — cookies are scoped by it, not by path. */
export function sessionKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

function sessionFile(key: string): string {
  return path.join(sessionsDir(), `${key.replace(/[^a-z0-9.-]/gi, '_')}.json`);
}

/** Whether this machine can open a window someone can type into. */
export function canOpenLoginWindow(): boolean {
  return process.env.RUNNING_IN_DOCKER !== '1' && !process.env.VERCEL;
}

/** The saved session for the URL's host, as a path Playwright can load. */
export async function savedSessionPath(url: string): Promise<string | null> {
  const key = sessionKey(url);
  if (!key) return null;
  const file = sessionFile(key);
  try {
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

export type LoginSessionStatus = {
  saved: boolean;
  savedAt: number | null;
  open: boolean;
};

export async function loginSessionStatus(
  url: string,
): Promise<LoginSessionStatus> {
  const key = sessionKey(url);
  if (!key) return { saved: false, savedAt: null, open: false };
  let savedAt: number | null = null;
  try {
    savedAt = (await stat(sessionFile(key))).mtimeMs;
  } catch {
    // Nothing saved yet
  }
  return { saved: savedAt !== null, savedAt, open: windows.has(key) };
}

async function writeState(key: string, state: StorageState) {
  await mkdir(sessionsDir(), { recursive: true });
  await writeFile(sessionFile(key), JSON.stringify(state), { mode: 0o600 });
}

async function snapshot(context: BrowserContext): Promise<StorageState> {
  return context.storageState({ indexedDB: true });
}

/**
 * Save what the window holds and close it.
 *
 * Called by "Done", and by the window itself when the person closes it — in
 * which case the browser can no longer be asked, and the last snapshot taken
 * while it was open is what gets written.
 */
async function finish(key: string): Promise<void> {
  const win = windows.get(key);
  if (!win) return;
  if (win.finishing) return win.finishing;
  win.finishing = (async () => {
    clearInterval(win.timer);
    // The full read, IndexedDB included, now that a page flashing open no
    // longer gets in anyone's way — or, with the window gone, the last one
    const state = await snapshot(win.context).catch(() => win.latest);
    await writeState(key, state);
    windows.delete(key);
    await win.browser.close().catch(() => {});
  })();
  return win.finishing;
}

/**
 * Open a visible browser on the URL, starting from the session already saved
 * for its host if there is one — so an expired login is refreshed rather than
 * redone from nothing, and a still-valid one can just be looked at.
 */
export async function openLoginWindow(url: string): Promise<void> {
  const key = sessionKey(url);
  if (!key) throw new Error('url is not a valid http(s) URL');
  if (!canOpenLoginWindow()) {
    throw new Error(
      'A login window can only be opened when the app runs directly on this ' +
        'machine (not in Docker or on a server).',
    );
  }

  const existing = windows.get(key);
  if (existing && !existing.finishing) {
    // Already open: bring it forward instead of opening a second one
    const page = existing.context.pages()[0];
    await page?.bringToFront().catch(() => {});
    return;
  }

  const { firefox } = await import('playwright');
  const browser = await firefox.launch({ headless: false });
  let context: BrowserContext;
  try {
    const saved = await savedSessionPath(url);
    context = await browser.newContext({
      // The window's own size, so the site can be used like any other tab
      viewport: null,
      ...(saved ? { storageState: saved } : {}),
    });
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }

  const win: LoginWindow = {
    browser,
    context,
    latest: { cookies: [], origins: [] },
    finishing: null,
    timer: setInterval(() => {
      quickSnapshot(context, win.latest).then(
        (state) => {
          win.latest = state;
        },
        () => {},
      );
    }, SNAPSHOT_MS),
  };
  windows.set(key, win);

  const page = await context.newPage();
  // Closing the window, or the whole browser, is the same as "Done"
  page.on('close', () => void finish(key));
  browser.on('disconnected', () => {
    if (windows.get(key) === win) void finish(key);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {
    // A slow or failing first load is the person's to deal with in the window
  });
}

/** "Done": write the session and close the window. */
export async function finishLoginWindow(url: string): Promise<void> {
  const key = sessionKey(url);
  if (key) await finish(key);
}

/** Forget the host's saved session, closing its window if one is open. */
export async function forgetLoginSession(url: string): Promise<void> {
  const key = sessionKey(url);
  if (!key) return;
  const win = windows.get(key);
  if (win) {
    clearInterval(win.timer);
    windows.delete(key);
    await win.browser.close().catch(() => {});
  }
  await rm(sessionFile(key), { force: true });
}

/** Read back for a context, or `null` when the file has gone bad. */
export async function readSavedSession(
  url: string,
): Promise<StorageState | null> {
  const file = await savedSessionPath(url);
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as StorageState;
  } catch {
    return null;
  }
}
