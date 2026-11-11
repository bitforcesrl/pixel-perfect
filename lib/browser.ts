import type { Browser } from 'playwright';

/**
 * Lazy-load Playwright browser types.
 *
 * A static `import { chromium, firefox } from 'playwright'` causes
 * `playwright-core` to read `browsers.json` at module-init time. On serverless
 * platforms such as Vercel that file may not be present in the deployment, so
 * the import crashes before any runtime logic can route the request to
 * Browserless. Deferring the import until a function actually needs the
 * browser keeps the module loadable everywhere.
 */
let _chromium: import('playwright').BrowserType | null = null;
let _firefox: import('playwright').BrowserType | null = null;

async function getChromium(): Promise<import('playwright').BrowserType> {
  if (!_chromium) {
    _chromium = (await import('playwright')).chromium;
  }
  return _chromium;
}

async function getFirefox(): Promise<import('playwright').BrowserType> {
  if (!_firefox) {
    _firefox = (await import('playwright')).firefox;
  }
  return _firefox;
}

/**
 * Where the browsers come from.
 *
 * Locally (and in the Docker image) Playwright launches its own bundled
 * Firefox — it renders closer to what designers see in Figma's default
 * engine and avoids Chromium-only anti-bot countermeasures that some hosts
 * deploy. Serverless hosts such as Vercel have no browser binary and no room
 * to install one, so there we drive a remote Chromium at Browserless.io
 * instead. Setting `BROWSERLESS_TOKEN` is what switches modes — leave it
 * unset and nothing about local development changes.
 */

/** Browserless region + protocol endpoint used when only a token is given. */
const DEFAULT_BROWSERLESS_ENDPOINT = 'wss://production-sfo.browserless.io';

/**
 * How long Browserless keeps the session alive. Its plans cap this, and asking
 * for more than the cap is rejected at connect time with a 400 — the free tier
 * allows 60s, so that is the only value guaranteed to connect anywhere. Raise
 * it via `BROWSERLESS_TIMEOUT_MS` on a plan that allows longer sessions; the
 * capture sizes its own waits to fit whatever budget it is given.
 */
const DEFAULT_SESSION_TIMEOUT_MS = 60_000;

/**
 * How many remote sessions to run at once. Plans cap this too, and going over
 * is rejected with a 429. The free tier allows one.
 */
const DEFAULT_CONCURRENCY = 1;

type Env = Record<string, string | undefined>;

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * The environment one capture runs under.
 *
 * Everything below reads its Browserless token out of the env it is handed, so
 * a request that carries its own key — or one that asks for the browser on this
 * machine — is expressed by handing it a different env rather than by threading
 * a second argument through the whole module. The deployment's own token wins
 * over a key typed into a browser: a server that has been configured is not
 * something a visitor gets to redirect.
 */
export function captureEnv(
  base: Env,
  opts: { clientToken?: string; forceLocal?: boolean } = {},
): Env {
  // No token at all is what sends `acquireBrowser` to the local browser
  if (opts.forceLocal) return { ...base, BROWSERLESS_TOKEN: undefined };
  if (base.BROWSERLESS_TOKEN?.trim()) return base;
  if (!opts.clientToken) return base;
  return { ...base, BROWSERLESS_TOKEN: opts.clientToken };
}

export function sessionTimeoutMs(env: Env = process.env): number {
  return positiveInt(env.BROWSERLESS_TIMEOUT_MS, DEFAULT_SESSION_TIMEOUT_MS);
}

/**
 * The Browserless websocket URL to connect to, or `null` when no token is
 * configured and we should launch a local browser.
 *
 * `BROWSERLESS_URL` overrides the endpoint — use it to pick another region
 * (`wss://production-lon.browserless.io`), to point at a self-hosted instance,
 * or to switch protocols (see {@link speaksPlaywrightProtocol}).
 */
export function browserlessEndpoint(env: Env = process.env): string | null {
  const token = env.BROWSERLESS_TOKEN?.trim();
  if (!token) return null;

  const url = new URL(
    env.BROWSERLESS_URL?.trim() || DEFAULT_BROWSERLESS_ENDPOINT,
  );
  // Browserless is reached over a websocket; accept an http(s) base anyway so
  // a copy-pasted dashboard URL still works.
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';

  url.searchParams.set('token', token);
  if (!url.searchParams.has('timeout')) {
    url.searchParams.set('timeout', String(sessionTimeoutMs(env)));
  }

  // Browserless's shared datacenter addresses are widely rate limited — by
  // Shopify among others — so a plan with residential proxying can route the
  // session through an address that looks like a visitor's.
  const proxy = env.BROWSERLESS_PROXY?.trim();
  if (proxy) {
    url.searchParams.set('proxy', proxy);
    const country = env.BROWSERLESS_PROXY_COUNTRY?.trim();
    if (country) url.searchParams.set('proxyCountry', country);
  }
  return url.toString();
}

/**
 * Browserless exposes two endpoints: the root speaks raw CDP, and
 * `/chromium/playwright` speaks Playwright's own protocol.
 *
 * We default to CDP even though Playwright calls it "lower fidelity", because
 * the Playwright protocol carries the client's version with it and Browserless
 * runs whichever version it runs. Against a mismatch, calls fail on arrival
 * ("page.goto: timeout: expected float, got undefined") — the capture connects
 * fine and then cannot do anything. CDP is stable across versions, and
 * everything this capture needs (`addStyleTag`, `frameLocator`,
 * `setViewportSize`, full-page screenshots) works over it.
 *
 * Point `BROWSERLESS_URL` at `.../chromium/playwright` to use the higher
 * fidelity protocol once the versions are known to line up.
 */
function speaksPlaywrightProtocol(endpoint: string): boolean {
  return new URL(endpoint).pathname.includes('playwright');
}

/** Keeps the token out of anything we might surface to a caller. */
function redactToken(message: string, env: Env): string {
  const token = env.BROWSERLESS_TOKEN?.trim();
  return token ? message.split(token).join('***') : message;
}

let localBrowser: Promise<Browser> | null = null;

function isRunningInDocker(): boolean {
  return process.env.RUNNING_IN_DOCKER === '1';
}

async function launchLocalBrowser(): Promise<Browser> {
  if (!localBrowser) {
    const firefox = await getFirefox();
    // Inside Docker, Firefox's content sandbox requires CLONE_NEWUSER which
    // the container's seccomp profile blocks when running as non-root.
    // --no-sandbox alone isn't enough: Firefox has multiple sandbox layers
    // and only MOZ_DISABLE_CONTENT_SANDBOX=1 disables the content one.
    // MOZ_WEBRENDER=0 disables GPU-accelerated rendering, avoiding the
    // SWGL framebuffer failure that happens when no display is available.
    const docker = isRunningInDocker();
    localBrowser = firefox.launch({
      args: docker ? ['--no-sandbox'] : [],
      env: docker
        ? {
          ...process.env,
          MOZ_DISABLE_CONTENT_SANDBOX: '1',
          MOZ_WEBRENDER: '0',
        }
        : undefined,
    });
    const launching = localBrowser;
    launching.then(
      (browser) => {
        // A crashed or killed Firefox would otherwise stay cached, and every
        // later capture would fail on it until the server restarts
        browser.on('disconnected', () => {
          if (localBrowser === launching) localBrowser = null;
        });
      },
      () => {
        // Allow retry on next request if launch fails
        if (localBrowser === launching) localBrowser = null;
      },
    );
  }
  return localBrowser;
}

/**
 * Lets only as many remote sessions run at once as the plan allows. One click
 * captures three viewports in parallel, which on the free tier (a single
 * concurrent session) means two of the three come back 429 unless they queue.
 *
 * This only covers sessions started by this process. Serverless requests can
 * land on separate instances that know nothing of each other, so the retry in
 * {@link connectRemote} still has to catch what slips past.
 */
function createSemaphore(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return {
    async acquire() {
      if (active >= limit)
        await new Promise<void>((resolve) => waiting.push(resolve));
      active++;
    },
    release() {
      active--;
      waiting.shift()?.();
    },
  };
}

let sessions: { limit: number; gate: ReturnType<typeof createSemaphore> } | null =
  null;

function sessionGate(env: Env) {
  const limit = positiveInt(env.BROWSERLESS_CONCURRENCY, DEFAULT_CONCURRENCY);
  if (!sessions || sessions.limit !== limit) {
    sessions = { limit, gate: createSemaphore(limit) };
  }
  return sessions.gate;
}

/** Attempts before giving up on a queue that never drains. */
const CONNECT_ATTEMPTS = 4;

function isRateLimited(message: string): boolean {
  return message.includes('429') || message.includes('Too Many Requests');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectRemote(
  endpoint: string,
  env: Env,
): Promise<{ browser: Browser; connectedAt: number }> {
  const chromium = await getChromium();
  let lastMessage = '';
  for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {
    // Browserless starts counting the session down from the moment it accepts
    // the socket, so the capture's budget is measured from this attempt — not
    // from the ones that bounced off the queue before it.
    const connectedAt = Date.now();
    try {
      const browser = speaksPlaywrightProtocol(endpoint)
        ? await chromium.connect(endpoint)
        : await chromium.connectOverCDP(endpoint);
      return { browser, connectedAt };
    } catch (err) {
      lastMessage = redactToken(
        err instanceof Error ? err.message : String(err),
        env,
      );
      // Anything else — a bad token, a timeout the plan won't allow — will fail
      // the same way on every retry.
      if (!isRateLimited(lastMessage) || attempt === CONNECT_ATTEMPTS - 1)
        break;
      // Someone else holds the session; wait out roughly one of them.
      await sleep(2_000 * 2 ** attempt + Math.random() * 500);
    }
  }
  throw new Error(`Failed to connect to Browserless: ${lastMessage}`);
}

export type BrowserLease = {
  browser: Browser;
  /** True when the browser runs at Browserless rather than on this machine. */
  remote: boolean;
  /**
   * Wall-clock time the capture has before the browser is taken away, or
   * `null` when nothing is going to take it away.
   */
  budgetMs: number | null;
  /** Hand the browser back. A no-op for the reused local instance. */
  release: () => Promise<void>;
};

/**
 * Whether this machine can launch a browser of its own. Serverless hosts ship
 * no browser binary and have no room to install one, so there the answer is no
 * and Browserless is the only way to capture anything.
 */
export function canLaunchLocally(env: Env = process.env): boolean {
  return !env.VERCEL;
}

/**
 * The browser running on this machine. It is a long-lived singleton — launching
 * Chromium takes seconds and the process outlives requests — so the lease hands
 * nothing back and imposes no time limit.
 */
export async function acquireLocalBrowser(): Promise<BrowserLease> {
  const browser = await launchLocalBrowser();
  return { browser, remote: false, budgetMs: null, release: async () => { } };
}

/**
 * Get a browser to capture with.
 *
 * Remote sessions are not reused the way the local browser is: Browserless
 * bills for session time and a serverless instance can be frozen between
 * invocations, so every request opens and closes its own session.
 */
export async function acquireBrowser(
  env: Env = process.env,
): Promise<BrowserLease> {
  const endpoint = browserlessEndpoint(env);

  if (!endpoint) {
    // A serverless deployment has no browser binary to launch, so failing here
    // with the missing variable named beats a confusing "executable doesn't
    // exist" from deep inside Playwright.
    if (!canLaunchLocally(env)) {
      throw new Error(
        'BROWSERLESS_TOKEN is not set. Serverless deployments have no local ' +
        'browser to launch — add the token from browserless.io to the ' +
        'project environment variables.',
      );
    }
    return acquireLocalBrowser();
  }

  const gate = sessionGate(env);
  await gate.acquire();

  let browser: Browser;
  let connectedAt: number;
  try {
    ({ browser, connectedAt } = await connectRemote(endpoint, env));
  } catch (err) {
    gate.release();
    throw err;
  }

  let released = false;

  return {
    browser,
    remote: true,
    budgetMs: sessionTimeoutMs(env) - (Date.now() - connectedAt),
    release: async () => {
      if (released) return;
      released = true;
      await browser.close().catch(() => { });
      gate.release();
    },
  };
}

/** Shuts down the reused local browser. Remote sessions close with their lease. */
export async function closeBrowser() {
  const pending = localBrowser;
  localBrowser = null;
  if (pending) {
    await pending.then((browser) => browser.close()).catch(() => { });
  }
}
