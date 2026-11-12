import {
  acquireBrowser,
  acquireLocalBrowser,
  canLaunchLocally,
  type BrowserLease,
} from './browser';
import { readSavedSession } from './login-session';
import { renderScaleFor } from './render-scale';
import type { ScreenshotRequest, ScreenshotResult } from './validation';

/** Cookies and storage from a login done by hand, see `login-session.ts`. */
type SavedSession = NonNullable<Awaited<ReturnType<typeof readSavedSession>>>;

export { closeBrowser } from './browser';

function isRunningInDocker(): boolean {
  return process.env.RUNNING_IN_DOCKER === '1';
}

/**
 * The remote browser cannot take this capture, but the one on this machine
 * probably can.
 *
 * Two things end up here. A loopback target has no route from Browserless at
 * all. And Browserless hands out shared datacenter addresses that many other
 * people hit the same hosts from, so a target that throttles by address —
 * Shopify answers with 429 `local_rate_limited` however politely you knock —
 * turns the session away for who it is rather than for what it asked. Both load
 * fine over this machine's own connection, so the capture is retried there when
 * there is a browser here to retry with.
 */
class RemoteBrowserUnsuitable extends Error {
  constructor(
    message: string,
    /** What to do instead, for when no local browser can take over. */
    readonly hint: string,
  ) {
    super(message);
  }
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

/**
 * Point the browser at something it can actually reach.
 *
 * Inside Docker, `localhost` / `127.0.0.1` in the target URL resolve to the
 * container's own loopback rather than the host machine, so rewrite them to
 * `host.docker.internal` — `docker-compose.yml` already maps it via
 * `extra_hosts`, so this is safe to enable automatically.
 *
 * A remote Browserless browser has no route to a loopback address at all;
 * saying so up front beats a 60s navigation timeout.
 */
function resolveTargetUrl(raw: string, remote: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw; // not a valid URL — let the caller handle the error
  }

  if (!isLoopback(parsed.hostname)) return raw;

  if (remote) {
    throw new RemoteBrowserUnsuitable(
      `${parsed.hostname} is not reachable from the remote browser at ` +
        'Browserless.',
      ' Use a publicly reachable URL, or capture with a local browser.',
    );
  }
  if (isRunningInDocker()) {
    parsed.hostname = 'host.docker.internal';
    return parsed.toString();
  }
  return raw;
}

const NAVIGATION_TIMEOUT_MS = 60_000;
const NETWORK_IDLE_TIMEOUT_MS = 30_000;
const SCROLL_PASS_MS = 120_000;
const IMAGE_WAIT_MS = 10_000;

/** Left for the screenshot itself, which on a very tall page is not instant. */
const CAPTURE_RESERVE_MS = 12_000;

/**
 * Sizes each wait to the time actually left.
 *
 * A local browser has none of these worries and keeps the generous limits
 * above. A remote one is on a clock — Browserless kills the session when the
 * plan's time is up, and the free tier's is 60s, less than a single one of
 * those waits. So every limit becomes a ceiling rather than a promise: take
 * the smaller of it and the time remaining, which lets a fast page use the
 * full pass and a slow one degrade to a shorter capture instead of dying with
 * nothing.
 */
function captureBudget(budgetMs: number | null) {
  const deadline =
    budgetMs === null ? Infinity : Date.now() + budgetMs - CAPTURE_RESERVE_MS;
  // Never hand a wait a zero or negative timeout: Playwright reads 0 as
  // "no timeout", which is the opposite of what a spent budget means.
  return (limit: number) =>
    Math.max(1_000, Math.min(limit, deadline - Date.now()));
}

/** Upper bound on capture height, to keep a runaway page from exhausting memory. */
const MAX_CAPTURE_HEIGHT = 30_000;

/*
 * Device pixels per CSS pixel: `renderScaleFor` the viewport width — 2x for a
 * mobile layout, which gets zoomed in a lot and where 1x type would smear next
 * to a crisp Figma export, sliding to 1x for a desktop one, which is viewed
 * near 100% and where 2x is mostly bytes. The Figma route picks its export
 * scale the same way, so both layers match.
 *
 * The remote browser follows it only below {@link REMOTE_HIGH_DENSITY_BELOW}:
 * it pays for every extra pixel in session time and in the size of the
 * answer, and a wide layout gains little from it. See `remoteScreenshot`.
 */

/** Remote captures narrower than this many CSS px are taken above 1x. */
const REMOTE_HIGH_DENSITY_BELOW = 768;

/**
 * Past this many device px a side, WebP cannot hold the picture and a remote
 * capture is encoded as JPEG instead (which goes to 65535).
 */
const MAX_WEBP_SIDE = 16_383;

/** Quality of a remote capture's WebP or JPEG — then the lighter fallback. */
const REMOTE_QUALITY = 85;
const REMOTE_FALLBACK_QUALITY = 65;

/**
 * The largest image a serverless deployment can send back, as base64
 * characters. Vercel refuses response bodies past ~4.5 MB; this leaves room
 * for the JSON around it. A capture over it is taken again lighter.
 */
const MAX_SERVERLESS_IMAGE_CHARS = 4_000_000;

/** Firefox refuses any screenshot taller (or wider) than this many device px. */
const MAX_SCREENSHOT_PX = 32_767;

/**
 * The page is too tall to capture at 2x within Firefox's screenshot limit. The
 * scale is fixed when the context opens, so the only way down to 1x is to take
 * the whole capture again.
 */
class TooTallForScale extends Error {}

/**
 * Hide the Shopify preview/theme bar.
 *
 * The bar is an iframe Shopify injects while previewing a theme. It is hidden
 * by style and then taken out of the DOM — nothing here clicks anything. The
 * bar's own "hide" control was tried once and is not worth it: the closest
 * thing to a stable handle on it is "the first button in the frame", which on
 * the current bar is a link into the theme editor, and following it captured
 * the redirect target instead of the page that was asked for. Removing the
 * element gets the same picture with no navigation to lose.
 */
async function hideShopifyPreviewBar(page: import('playwright').Page) {
  // Strategy 1: Inject CSS to forcefully hide known bar elements
  await page.addStyleTag({
    content: `
      #preview-bar-iframe,
      iframe[id*="preview-bar"],
      iframe[src*="preview_bar"],
      iframe[src*="preview-bar"],
      .shopify-preview-bar,
      #admin-bar-iframe,
      iframe[id*="admin-bar"],
      [data-preview-bar],
      .preview-bar-container,
      #preview-bar-container {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        position: absolute !important;
        top: -9999px !important;
      }
    `,
  });

  // Strategy 2: Remove matching elements from the DOM
  await page.evaluate(() => {
    const selectors = [
      '#preview-bar-iframe',
      'iframe[id*="preview-bar"]',
      'iframe[src*="preview_bar"]',
      'iframe[src*="preview-bar"]',
      '.shopify-preview-bar',
      '#admin-bar-iframe',
      'iframe[id*="admin-bar"]',
      '[data-preview-bar]',
      '.preview-bar-container',
      '#preview-bar-container',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
  });

  // Wait for any layout shift after hiding the bar
  await page.waitForTimeout(500);
}

/**
 * The consent dialog, gone before anything is measured or shot.
 *
 * A cookie banner sits over the fold, blocks scrolling on many themes, and ends
 * up in the capture as a slab of someone else's UI. "Accept all" is what gets
 * clicked: it is the one answer every banner offers, and the one that closes
 * the layer outright instead of opening a preferences panel behind it.
 *
 * This ran once as a reject-first, match-anything pass and had to come out: a
 * bare "ok" / "accept" / "agree" also matches ordinary links, so the click
 * navigated and the capture came back showing the redirect target. Three rules
 * keep that from happening again — only whole "accept all"-shaped phrases, only
 * controls that sit inside something naming itself after consent, and no anchor
 * that points anywhere but itself. `preventNavigation` is the backstop for
 * whatever still gets through.
 *
 * The work happens in the page rather than through Playwright locators because
 * the button is as often as not inside a shadow root or a CMP's own iframe;
 * this walks both, in every frame, and matches the way the button is labelled
 * rather than which vendor drew it.
 */
function answerConsent(): boolean {
  /** The vendor's own button: its id says what it does with no ambiguity. */
  const ACCEPT_IDS = [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '#CybotCookiebotDialogBodyLevelButtonAccept',
    '#didomi-notice-agree-button',
    '#uc-btn-accept-banner',
    '[data-testid="uc-accept-all-button"]',
    '.cc-allow',
    '.cky-btn-accept',
    '[data-cky-tag="accept-button"]',
    '.osano-cm-acceptAll',
    '#truste-consent-button',
    '.cmplz-accept',
    '#cookiescript_accept',
    '.iubenda-cs-accept-btn',
    '.termly-styles-button-accept-all',
    '.shopify-pc__banner__btn-accept',
    '#hs-eu-confirmation-button',
    '.cmpboxbtnyes',
    '#axeptio_btn_acceptAll',
    '.qc-cmp2-summary-buttons > button[mode="primary"]',
  ];

  /**
   * Lowercased, accent-stripped labels, English and Italian — the languages
   * the pages captured here are written in. Whole phrases only: an "accept" or
   * an "ok" on its own matches half the buttons on a normal page.
   */
  const ACCEPT_WORDS = [
    'accept all cookies',
    'accept all',
    'accept cookies',
    'accept & close',
    'accept and close',
    'allow all cookies',
    'allow all',
    'allow cookies',
    'i accept',
    'agree and close',
    'agree to all',
    'i agree',
    'accetta tutti i cookie',
    'accetta tutti',
    'accetta tutto',
    'accetto tutti',
    'accetto tutto',
    'accetta e chiudi',
    'accetta i cookie',
    'consenti tutti',
    'consenti tutto',
    'acconsento',
  ];

  /**
   * What a consent layer calls itself. The button has to sit inside one, which
   * is what keeps the "I agree" in a signup form out of reach.
   */
  const CONSENT_NAMES =
    /cookie|consent|gdpr|ccpa|privacy|cmp|onetrust|cybot|didomi|usercentrics|iubenda|osano|cky|termly|klaro|borlabs|complianz|cookiescript|axeptio|trustarc|truste|quantcast|qc-cmp|shopify-pc/i;

  const norm = (raw: string | null | undefined) =>
    (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  /** Every element in the frame, shadow roots walked as if they were inline. */
  const walk = (root: Document | ShadowRoot, out: HTMLElement[]) => {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };

  const clickable = (el: HTMLElement) => {
    if (typeof el.click !== 'function') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    const style = getComputedStyle(el);
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0.05
    );
  };

  /**
   * A control, and one that stays on this page. An anchor counts as a button
   * only when its href goes nowhere: a real destination means it is the link
   * to the privacy policy, not the accept button next to it.
   */
  const isControl = (el: HTMLElement) => {
    if (el.tagName === 'BUTTON') return true;
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type.toLowerCase();
      return type === 'button' || type === 'submit';
    }
    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') || '').trim();
      return href === '' || href === '#' || href.startsWith('javascript:');
    }
    return el.getAttribute('role') === 'button';
  };

  /** Inside a consent layer, by the names on the element or its ancestors. */
  const inConsentLayer = (el: HTMLElement) => {
    let node: HTMLElement | null = el;
    for (let depth = 0; node && depth < 12; depth++) {
      const names = [
        node.id,
        typeof node.className === 'string' ? node.className : '',
        node.getAttribute('data-testid') || '',
        node.getAttribute('aria-label') || '',
      ].join(' ');
      if (CONSENT_NAMES.test(names)) return true;
      // Step out of a shadow root, which `parentElement` alone cannot do.
      const root = node.getRootNode();
      node =
        node.parentElement ||
        (root instanceof ShadowRoot ? (root.host as HTMLElement) : null);
    }
    return false;
  };

  const all = walk(document, []);

  for (const el of all) {
    if (!ACCEPT_IDS.some((sel) => el.matches(sel))) continue;
    if (!clickable(el)) continue;
    el.click();
    return true;
  }

  // Then by label. Longest phrase wins, so "accept all cookies" is preferred
  // over the "accept cookies" the same label also matches.
  let best: HTMLElement | null = null;
  let bestLength = 0;
  for (const el of all) {
    if (!isControl(el) || !clickable(el) || !inConsentLayer(el)) continue;
    const label = norm(
      el.innerText ||
        (el as HTMLInputElement).value ||
        el.getAttribute('aria-label'),
    );
    if (label.length === 0 || label.length > 60) continue;
    for (const word of ACCEPT_WORDS) {
      if (!label.includes(word)) continue;
      if (word.length <= bestLength) continue;
      best = el;
      bestLength = word.length;
    }
  }
  if (!best) return false;
  best.click();
  return true;
}

/**
 * Whatever gets clicked next, the page stays where it is.
 *
 * A capture-phase listener that cancels nothing but the browser's own default:
 * the CMP's handler still runs and still dismisses the banner, while an anchor
 * that turned out to be a link takes nobody anywhere. Returns the teardown,
 * which must run before the page is measured — the scroll passes click
 * nothing, but a page left with a listener that eats every anchor is not the
 * page that was asked for.
 */
async function preventNavigation(page: import('playwright').Page) {
  const KEY = '__ppConsentNavGuard';
  for (const frame of page.frames()) {
    await frame
      .evaluate((key) => {
        const guard = (event: Event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('a[href]')) {
            event.preventDefault();
          }
        };
        (window as unknown as Record<string, unknown>)[key] = guard;
        document.addEventListener('click', guard, true);
      }, KEY)
      .catch(() => {});
  }
  return async () => {
    for (const frame of page.frames()) {
      await frame
        .evaluate((key) => {
          const store = window as unknown as Record<string, unknown>;
          const guard = store[key] as EventListener | undefined;
          if (guard) document.removeEventListener('click', guard, true);
          delete store[key];
        }, KEY)
        .catch(() => {});
    }
  };
}

async function clickConsent(page: import('playwright').Page): Promise<boolean> {
  // Every frame: CMPs such as TrustArc and older OneTrust draw the banner in an
  // iframe of their own, where the main document's DOM never sees it.
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate(answerConsent).catch(() => false);
    if (clicked) return true;
  }
  return false;
}

/**
 * Run some clicking with the page held where it is.
 *
 * The guard cancels an anchor's default; a handler that sets `location` itself
 * gets past it, so a navigation that happened anyway is undone by going back
 * to the URL the page was on — where it landed after redirects, not
 * necessarily the URL the capture was asked for.
 */
async function withoutNavigation(
  page: import('playwright').Page,
  timeoutMs: number,
  work: () => Promise<void>,
) {
  const landedUrl = page.url();
  const release = await preventNavigation(page);
  try {
    await work();
  } catch {
    // Something on the page that will not close is not a reason to lose the
    // capture
  } finally {
    await release().catch(() => {});
  }

  try {
    if (page.url() !== landedUrl) {
      await page.goto(landedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
    }
  } catch {
    // Elsewhere and unable to return — capture what is on screen
  }
}

/**
 * Take the cookies so the banner goes away.
 *
 * Returns once the banner has been answered and given a moment to unmount —
 * the reflow it leaves behind must land before anything measures the page.
 */
async function dismissConsentBanner(
  page: import('playwright').Page,
  timeoutMs: number,
) {
  await withoutNavigation(page, timeoutMs, async () => {
    if (!(await clickConsent(page))) return;
    await page.waitForTimeout(600);
    // Some CMPs swap the banner for a second layer ("manage preferences"
    // style) rather than closing outright, so one more pass takes whatever is
    // still standing.
    await clickConsent(page);
    await page.waitForTimeout(300);
  });
}

/**
 * Close, or failing that hide, every popup standing over the page.
 *
 * Newsletter signups, discount wheels, "welcome" lightboxes: none of them is
 * the page, and a fixed one lands in the capture's first screenful. A popup is
 * something fixed to the viewport that either says it is a dialog (`dialog`,
 * `role="dialog"`, `aria-modal`) or names itself like one. Its own close
 * control is clicked first, so the theme also lifts its scroll lock and
 * backdrop the way it would for a visitor; in `hide` mode whatever is still
 * standing is closed (`<dialog>`) and taken out of the layout.
 *
 * Two kinds of name, because "modal" and "overlay" also turn up on the
 * site's own furniture: those only count for an element that covers the middle
 * of the viewport or a good share of it, which a sticky header never does. A
 * newsletter or popup-app name counts wherever it sits, corner teasers
 * included.
 */
function closePopups(mode: 'click' | 'hide'): number {
  const STRONG_NAMES =
    /newsletter|popup|pop-up|klaviyo|privy|omnisend|mailchimp|signup|sign-up|subscribe|discount|promo|lightbox|optinmonster|justuno|wisepops|attentive|spin-?wheel|exit-?intent/i;
  const WEAK_NAMES = /modal|overlay|backdrop|dialog/i;
  const DIALOG =
    'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
  const CLOSE_LABELS =
    /\b(close|chiudi|dismiss|no,? thanks|no,? grazie|not now|non ora|maybe later|continue shopping)\b/;
  const CLOSE_GLYPHS = new Set([
    'x',
    '\u00d7',
    '\u2715',
    '\u2716',
    '\u2573',
    '\u2717',
  ]);
  const CLOSE_NAMES = /close|dismiss/i;

  const norm = (raw: string | null | undefined) =>
    (raw || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const walk = (root: Document | ShadowRoot, out: HTMLElement[]) => {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };

  const parentOf = (el: HTMLElement): HTMLElement | null => {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
  };

  const visible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    const style = getComputedStyle(el);
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0.05
    );
  };

  /** Fixed to the viewport, itself or through an ancestor. */
  const fixed = (el: HTMLElement) => {
    for (let node: HTMLElement | null = el; node; node = parentOf(node)) {
      if (node === document.body || node === document.documentElement) break;
      if (getComputedStyle(node).position === 'fixed') return true;
    }
    return false;
  };

  const names = (el: HTMLElement) =>
    [
      el.id,
      typeof el.className === 'string' ? el.className : '',
      el.tagName,
      el.getAttribute('data-section-type') || '',
      el.getAttribute('aria-label') || '',
    ].join(' ');

  const coversMiddle = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = Math.min(vh, 900) / 2;
    const covers =
      rect.left <= cx &&
      rect.right >= cx &&
      rect.top <= cy &&
      rect.bottom >= cy;
    return covers || (rect.width * rect.height) / (vw * vh) >= 0.25;
  };

  const isPopup = (el: HTMLElement) => {
    if (el === document.body || el === document.documentElement) return false;
    if (el.tagName === 'HEADER' || el.tagName === 'NAV') return false;
    const named = names(el);
    const strong = STRONG_NAMES.test(named);
    const dialog = el.matches(DIALOG) || WEAK_NAMES.test(named);
    if (!strong && !dialog) return false;
    if (!visible(el) || !fixed(el)) return false;
    return strong || coversMiddle(el);
  };

  // Outermost only: a popup's own inner parts are not popups of their own
  const all = walk(document, []);
  const popups = all.filter(isPopup);
  const outer = popups.filter((el) => {
    for (let node = parentOf(el); node; node = parentOf(node)) {
      if (popups.includes(node)) return false;
    }
    return true;
  });

  if (mode === 'hide') {
    for (const el of outer) {
      if (el instanceof HTMLDialogElement && el.open) el.close();
      el.style.setProperty('display', 'none', 'important');
    }
    return outer.length;
  }

  const isCloseControl = (el: HTMLElement) => {
    if (!visible(el)) return false;
    const label = norm(
      el.getAttribute('aria-label') || el.getAttribute('title') || '',
    );
    if (CLOSE_LABELS.test(label)) return true;
    const text = norm(el.innerText);
    if (
      CLOSE_GLYPHS.has(text) ||
      (text.length <= 30 && CLOSE_LABELS.test(text))
    )
      return true;
    // An icon-only button: nothing to read but its class
    const control =
      el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
    return control && text === '' && CLOSE_NAMES.test(names(el));
  };

  let clicked = 0;
  for (const popup of outer) {
    const inside = [
      popup,
      ...all.filter((el) => el !== popup && popup.contains(el)),
    ];
    // Shadow content is not `contains`-reachable; walk the popup's own tree
    if (popup.shadowRoot) inside.push(...walk(popup.shadowRoot, []));
    const close = inside.find(
      (el) =>
        isCloseControl(el) &&
        // A real destination is a link to somewhere, not a close button
        !(
          el.tagName === 'A' &&
          /^(https?:)?\/\//.test(el.getAttribute('href') || '')
        ),
    );
    if (!close) continue;
    close.click();
    clicked++;
  }
  return clicked;
}

async function dismissPopups(
  page: import('playwright').Page,
  timeoutMs: number,
) {
  await withoutNavigation(page, timeoutMs, async () => {
    if ((await page.evaluate(closePopups, 'click' as const)) > 0) {
      // Close animations, and the theme lifting its scroll lock
      await page.waitForTimeout(600);
    }
    if ((await page.evaluate(closePopups, 'hide' as const)) > 0) {
      await page.waitForTimeout(200);
    }
  });
}

/**
 * `fullPage` screenshots are only as tall as `documentElement.scrollHeight`.
 * Pages that keep their content inside a scroll container — an `overflow:auto`
 * wrapper, or the fixed + transformed wrapper used by smooth-scroll libraries
 * such as Locomotive, Lenis and ScrollSmoother — never grow the document, so
 * the capture stops at the fold. Unwrap those containers so the document
 * itself becomes the scroller.
 */
async function unwrapScrollContainers(page: import('playwright').Page) {
  await page.evaluate(() => {
    const html = document.documentElement;
    const important = (el: HTMLElement, prop: string, value: string) =>
      el.style.setProperty(prop, value, 'important');

    for (const root of [html, document.body]) {
      if (!root) continue;
      important(root, 'height', 'auto');
      important(root, 'min-height', '0');
      important(root, 'max-height', 'none');
      important(root, 'overflow', 'visible');
    }

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const style = getComputedStyle(el);
      const overflows = el.scrollHeight > el.clientHeight + 50;
      const clips = ['hidden', 'auto', 'scroll', 'clip'].includes(
        style.overflowY,
      );
      // Only unwrap containers that stand in for the page scroller: they hold
      // more than a screenful and occupy the viewport. This leaves small
      // scrollable widgets (dropdowns, code blocks, carousels) untouched.
      const isPageScroller =
        overflows &&
        (clips || style.position === 'fixed') &&
        el.clientHeight >= window.innerHeight * 0.8;
      if (!isPageScroller) continue;

      if (style.position === 'fixed' || style.position === 'absolute') {
        important(el, 'position', 'static');
      }
      important(el, 'height', 'auto');
      important(el, 'max-height', 'none');
      important(el, 'overflow', 'visible');
      // Smooth-scroll libraries offset content with a transform; reset it here
      // and on the immediate children so everything sits at its natural place.
      important(el, 'transform', 'none');
      for (const child of Array.from(el.children)) {
        important(child as HTMLElement, 'transform', 'none');
      }
    }
  });
}

/**
 * True height of the rendered content, including anything still overflowing a
 * container that could not be unwrapped.
 */
async function measureContentHeight(page: import('playwright').Page) {
  return page.evaluate(() => {
    let height = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
    );
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      height = Math.max(height, top + el.scrollHeight);
    }
    return Math.ceil(height);
  });
}

/**
 * Walk the page top to bottom to trigger lazy sections, then settle at the
 * bottom until it stops growing.
 *
 * The page height must be re-read on every step: sections that render on
 * intersection each reveal the next one, so a height sampled up front stops
 * the walk long before the footer — leaving the tail of the page unrendered.
 */
async function scrollUntilSettled(
  page: import('playwright').Page,
  budgetMs: number,
) {
  await page.evaluate(async (budget) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    const until = Date.now() + budget;
    let guard = 0;

    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      if (guard++ > 400 || Date.now() > until) break;
      window.scrollTo(0, y);
      await sleep(250);
    }

    // Sit at the bottom until the height repeats — the last section to load
    // may still be pulling in the one after it.
    let previous = -1;
    let stableRounds = 0;
    while (stableRounds < 3 && guard++ < 500 && Date.now() < until) {
      const height = document.documentElement.scrollHeight;
      window.scrollTo(0, height);
      await sleep(400);
      stableRounds =
        document.documentElement.scrollHeight === height && height === previous
          ? stableRounds + 1
          : 0;
      previous = height;
    }

    window.scrollTo(0, 0);
    await sleep(200);
  }, budgetMs);
}

/**
 * Off-screen content stays unpainted when it is deferred with
 * `content-visibility` or `loading="lazy"`; both leave a correctly sized but
 * empty box in the capture. Opt everything in and wait for the images.
 */
async function forceEagerRendering(
  page: import('playwright').Page,
  budgetMs: number,
) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      content-visibility: visible !important;
      contain-intrinsic-size: auto !important;
    }`,
  });
  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('[loading="lazy"]'),
    )) {
      el.setAttribute('loading', 'eager');
    }
    for (const img of Array.from(document.images)) {
      img.decoding = 'sync';
      // Themes commonly park the real source on a data attribute.
      if (!img.getAttribute('src') && img.dataset.src) {
        img.src = img.dataset.src;
      }
      if (!img.getAttribute('srcset') && img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
    }
  });
  // Give the images a bounded window to finish; a stalled one must not hang
  // the whole capture.
  await page
    .evaluate(async (budget) => {
      const pending = Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
        );
      await Promise.race([
        Promise.all(pending),
        new Promise((r) => setTimeout(r, budget)),
      ]);
    }, budgetMs)
    .catch(() => {});
}

/** Statuses a host uses to turn a caller away for who it is. */
const BLOCKED_BY_ADDRESS = new Set([403, 429]);

/** The way out when no local browser can take the capture over. */
const PROXY_HINT =
  ' The remote browser shares its IP address with other Browserless users, ' +
  'which is what the target is rate limiting. Route the session through a ' +
  'residential proxy with BROWSERLESS_PROXY=residential.';

/**
 * Statuses whose body is a page someone designed.
 *
 * A 404 is the obvious one: it is a real template with a layout to match
 * against a Figma export, and the whole point of pointing this app at
 * `/does-not-exist` is to style it. 410 is the same page under another name.
 */
const STYLEABLE_STATUSES = new Set([404, 410]);

/**
 * Refuse to hand back a picture of an error page.
 *
 * A rejected request still renders, so without this the capture "succeeds" and
 * the comparison silently becomes a diff against a blank white page. Whoever
 * asked for the screenshot needs to hear why there isn't one — unless the
 * status is one whose body is the page you meant to shoot.
 */
function assertPageWasServed(
  response: import('playwright').Response | null,
  remote: boolean,
) {
  const status = response?.status();
  if (status === undefined || status < 400) return;
  if (STYLEABLE_STATUSES.has(status)) return;

  const message = `The page answered ${status}, so there is nothing to capture.`;
  throw remote && BLOCKED_BY_ADDRESS.has(status)
    ? new RemoteBrowserUnsuitable(message, PROXY_HINT)
    : new Error(message);
}

/** Statuses a password gate answers with while it is standing. */
const GATED_STATUSES = new Set([401, 403]);

/** How long a submitted password gets to turn into a navigation. */
const PASSWORD_SUBMIT_MS = 15_000;

/**
 * The password field of the gate in front of the page, if there is one.
 *
 * Visible first. Shopify's own password page keeps its field inside a
 * `<details>` modal that opens on "Enter using password", so a field that only
 * exists hidden gets its disclosure opened once before it is settled for as it
 * is — `submitSitePassword` can still fill a hidden one through the DOM.
 */
async function findPasswordField(page: import('playwright').Page) {
  const fields = page.locator('input[type="password"]');
  const firstVisible = async () => {
    const count = await fields.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      if (
        await fields
          .nth(i)
          .isVisible()
          .catch(() => false)
      )
        return fields.nth(i);
    }
    return null;
  };

  const visible = await firstVisible();
  if (visible) return visible;
  if ((await fields.count().catch(() => 0)) === 0) return null;

  const disclosure = page
    .locator('details:has(input[type="password"]) > summary')
    .first();
  if ((await disclosure.count().catch(() => 0)) > 0) {
    await disclosure.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  return (await firstVisible()) ?? fields.first();
}

/** Resolves once the main frame has navigated, or after `timeoutMs` regardless. */
function mainFrameNavigation(
  page: import('playwright').Page,
  timeoutMs: number,
) {
  return page
    .waitForEvent('framenavigated', {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: timeoutMs,
    })
    .then(() => true)
    .catch(() => false);
}

/**
 * Type the password and send the form it belongs to.
 *
 * A visible field is filled and answered with Enter, the way a person would,
 * so script-driven forms see the events they listen for. A hidden one, or a
 * form that ignores Enter, is submitted through the DOM instead.
 */
async function submitSitePassword(
  page: import('playwright').Page,
  field: import('playwright').Locator,
  password: string,
) {
  const submitThroughDom = () =>
    field.evaluate((input, value) => {
      const el = input as HTMLInputElement;
      // The native setter, so a framework-controlled input sees the change
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const form = el.form;
      if (!form) return;
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }, password);

  if (await field.isVisible().catch(() => false)) {
    await field.fill(password, { timeout: 5_000 });
    const navigated = mainFrameNavigation(page, PASSWORD_SUBMIT_MS);
    await field.press('Enter', { timeout: 5_000 });
    if (await navigated) return;
    // Enter went nowhere: no submit button in the form, or nothing listening
    if (!(await field.isVisible().catch(() => false))) return;
  }
  const navigated = mainFrameNavigation(page, PASSWORD_SUBMIT_MS);
  await submitThroughDom();
  await navigated;
}

/**
 * Get past the site's password gate, then come back to the page asked for.
 *
 * Only a page that actually shows a password field is touched; a public page
 * goes through untouched even with a password set. Once the form is sent the
 * session holds whatever cookie the site handed out, and the target is loaded
 * again: Shopify sends a store that has just been unlocked to its home page,
 * not to the path that was asked for. A gate still standing after that is a
 * wrong password, said as much rather than captured.
 */
async function passPasswordGate(
  page: import('playwright').Page,
  targetUrl: string,
  password: string,
  response: import('playwright').Response | null,
  timeoutMs: number,
) {
  // Only a gate gets the password: a refusal, or Shopify's own /password page.
  // A public page can still carry a password field — a theme's hidden login
  // drawer — and typing the site password into that is a customer login
  // attempt, not a way in.
  const onPasswordPage = /\/password\/?$/.test(new URL(page.url()).pathname);
  if (!GATED_STATUSES.has(response?.status() ?? 0) && !onPasswordPage)
    return response;
  const field = await findPasswordField(page);
  if (!field) return response;

  await submitSitePassword(page, field, password);
  await page
    .waitForLoadState('domcontentloaded', { timeout: timeoutMs })
    .catch(() => {});

  const reloaded = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  if (
    GATED_STATUSES.has(reloaded?.status() ?? 0) &&
    (await findPasswordField(page))
  ) {
    throw new Error(
      'The site password was not accepted — check the one set on this page.',
    );
  }
  return reloaded;
}

/**
 * Say "password" instead of "401" when that is what the page is asking for.
 *
 * Only a refusal counts: a page that answers 200 with a login form on it is a
 * page someone may well want to capture as it is.
 */
async function assertNotPasswordGated(
  page: import('playwright').Page,
  response: import('playwright').Response | null,
) {
  if (!GATED_STATUSES.has(response?.status() ?? 0)) return;
  if (!(await findPasswordField(page))) return;
  throw new Error(
    'The site is password protected. Add its password to this page in Pages ' +
      'and capture again.',
  );
}

/** Reads the pixel dimensions out of a PNG's IHDR chunk. */
function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Put the viewport back, even when Playwright thinks it never left.
 *
 * Over CDP a navigation drops the emulation override and the page falls back to
 * Chrome's own 800x600 window. Asking for the same size again does nothing:
 * Playwright caches the last `Emulation.setDeviceMetricsOverride` it sent and
 * skips the call when the new metrics match, so its cache still says 1440x900
 * while the renderer is at 800x600 — the capture then comes back 800px wide
 * with no error anywhere. Setting a size that differs by one pixel first
 * invalidates that cache, and the real size lands on the second call.
 */
async function applyViewport(
  page: import('playwright').Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize({ ...viewport, height: viewport.height + 1 });
  await page.setViewportSize(viewport);
}

type CDPSession = import('playwright').CDPSession;

/**
 * Set the remote page's device pixel ratio, keeping its size. Playwright's
 * own resizes always send 1x over CDP (its context has no scale), so this is
 * sent after each of them.
 */
async function setDensity(
  cdp: CDPSession,
  size: { width: number; height: number },
  scale: number,
) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: scale,
    mobile: false,
  });
}

/**
 * The full page from the remote browser, as WebP (JPEG past WebP's size
 * limit) rather than PNG: the picture travels back as base64 in a JSON
 * answer, and a PNG of a tall 2x page is several times what a serverless
 * response may hold. WebP at this quality is far lighter and indistinguishable
 * for aligning against a design.
 *
 * Tried heaviest first, falling back until it fits: the asked scale, then 1x,
 * then 1x at a lower quality. `limitChars` is the most a response may carry —
 * null where there is no such limit, which keeps the first attempt that the
 * format can hold. Over the limit even at its lightest, it says so plainly
 * rather than letting the platform fail with an opaque error.
 */
async function remoteScreenshot(
  cdp: CDPSession,
  scale: number,
  {
    viewportWidth,
    limitChars,
  }: { viewportWidth: number; limitChars: number | null },
): Promise<ScreenshotResult> {
  // A classic scrollbar takes its width out of the page (375 came back as
  // 368): hide it, and never return narrower than the viewport asked for —
  // the overlay fits the Figma export to this width
  await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });
  const { cssContentSize } = await cdp.send('Page.getLayoutMetrics');
  const width = Math.max(Math.ceil(cssContentSize.width), viewportWidth);
  const height = Math.min(Math.ceil(cssContentSize.height), MAX_CAPTURE_HEIGHT);

  const attempts = [
    ...(scale > 1 && height * scale <= MAX_WEBP_SIDE
      ? [{ scale, quality: REMOTE_QUALITY }]
      : []),
    { scale: 1, quality: REMOTE_QUALITY },
    { scale: 1, quality: REMOTE_FALLBACK_QUALITY },
  ];

  let density = scale;
  let size = 0;
  for (const attempt of attempts) {
    if (attempt.scale !== density) {
      // Same layout, fewer device pixels: no reload, the next shot is lighter
      await setDensity(cdp, { width, height }, attempt.scale);
      density = attempt.scale;
    }
    const deviceSide = Math.max(width, height) * attempt.scale;
    const format = deviceSide <= MAX_WEBP_SIDE ? 'webp' : 'jpeg';
    const { data } = await cdp.send('Page.captureScreenshot', {
      format,
      quality: attempt.quality,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    size = data.length;
    if (limitChars === null || size <= limitChars) {
      return {
        image: `data:image/${format};base64,${data}`,
        width,
        height,
      };
    }
  }
  throw new Error(
    `The page is too tall to send back from this deployment ` +
      `(${(size / 1_000_000).toFixed(1)} MB even at 1x). Capture it on a ` +
      'self-hosted install, or upload a screenshot instead.',
  );
}

/** The density a capture is taken at, before any fallback. */
function captureScale(remote: boolean, cssWidth: number): number {
  if (remote && cssWidth >= REMOTE_HIGH_DENSITY_BELOW) return 1;
  return renderScaleFor(cssWidth);
}

async function captureWith(
  lease: BrowserLease,
  req: ScreenshotRequest,
  session: SavedSession | null,
  scale = captureScale(lease.remote, req.viewportWidth),
): Promise<ScreenshotResult> {
  const budget = captureBudget(lease.budgetMs);
  const viewport = { width: req.viewportWidth, height: req.viewportHeight };
  // A remote browser is driven over CDP, which ignores these options — and
  // worse, a context that was told it has a viewport then refuses to change
  // it, leaving every capture at Chrome's default 800x600. Left bare, the
  // per-page emulation below is free to do its job.
  let context: import('playwright').BrowserContext;
  try {
    context = await lease.browser.newContext(
      lease.remote
        ? {}
        : {
            viewport,
            deviceScaleFactor: scale,
            // Already logged in, the way the person left the login window
            ...(session ? { storageState: session } : {}),
          },
    );
  } catch (err) {
    // A session dropped before the context opened still holds its slot in the
    // concurrency gate — hand it back, or every later capture queues forever
    await lease.release();
    throw err;
  }
  try {
    const page = await context.newPage();
    // The remote browser takes its density from the DevTools protocol: the
    // context options that set it locally do not reach it over CDP
    // (Chromium only — anything else keeps Playwright's own screenshot)
    const cdp =
      lease.remote && lease.browser.browserType().name() === 'chromium'
        ? await context.newCDPSession(page)
        : null;
    const remoteDensity = (size: { width: number; height: number }) =>
      cdp && scale > 1 ? setDensity(cdp, size, scale) : Promise.resolve();
    // The remote context has no viewport of its own, so give the page one
    // before it loads anything.
    await page.setViewportSize(viewport);
    await remoteDensity(viewport);

    const targetUrl = resolveTargetUrl(req.url, lease.remote);

    // Navigate with 'domcontentloaded' — much faster than 'load' and avoids
    // hanging on pages with resources that never finish (analytics, live chat,
    // slow third-party scripts).  We follow up with a best-effort networkidle
    // wait below so the page has a chance to settle before capture.
    let response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: budget(NAVIGATION_TIMEOUT_MS),
    });
    // A password gate answers before the page does: get past it with the
    // page's password, or say that one is needed rather than "401"
    if (req.sitePassword) {
      response = await passPasswordGate(
        page,
        targetUrl,
        req.sitePassword,
        response,
        budget(NAVIGATION_TIMEOUT_MS),
      );
    } else {
      await assertNotPasswordGated(page, response);
    }
    assertPageWasServed(response, lease.remote);

    // ...and again, because navigating drops the emulated viewport on a remote
    // browser and puts it back at 800x600. Re-applying it here is what makes
    // the capture the size that was asked for; the browser re-picks `srcset`
    // candidates on the resize, and the lazy-loading passes below run after.
    await applyViewport(page, viewport);
    // Playwright's own resize put the density back to 1x: set it again
    await remoteDensity(viewport);

    // Best-effort: let the page finish loading resources, but don't crash the
    // capture if something hangs.
    await page
      .waitForLoadState('networkidle', {
        timeout: budget(NETWORK_IDLE_TIMEOUT_MS),
      })
      .catch(() => {});

    // Accept the cookies before anything measures or scrolls the page: the
    // banner blocks scrolling on many themes and shifts the layout on its way
    // out.
    await dismissConsentBanner(page, budget(NAVIGATION_TIMEOUT_MS));
    // Then whatever else stands over the page: newsletter signups, promos
    await dismissPopups(page, budget(NAVIGATION_TIMEOUT_MS));

    // Hide Shopify preview bar before anything else
    await hideShopifyPreviewBar(page);

    // Make the document itself the scroller so `fullPage` can see everything.
    await unwrapScrollContainers(page);

    // Walk the page so every lazy section renders, then scroll back to top.
    await forceEagerRendering(page, budget(IMAGE_WAIT_MS));
    await scrollUntilSettled(page, budget(SCROLL_PASS_MS));

    // Scroll handlers may have re-applied the transforms we cleared, and lazy
    // content arrives with its own containers and deferred media, so redo both
    // passes now that the whole page exists.
    await unwrapScrollContainers(page);
    await forceEagerRendering(page, budget(IMAGE_WAIT_MS));

    // Wait for any network activity triggered by scrolling to settle
    await page
      .waitForLoadState('networkidle', {
        timeout: budget(NETWORK_IDLE_TIMEOUT_MS),
      })
      .catch(() => {
        // Timeout is acceptable — proceed with what we have
      });

    // Extra small delay to let images decode
    await page.waitForTimeout(500);

    const contentHeight = Math.min(
      await measureContentHeight(page),
      MAX_CAPTURE_HEIGHT,
    );
    const documentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );

    // Some containers refuse to unwrap (cross-origin frames, JS that re-locks
    // the layout on every frame). Growing the viewport to the content height
    // makes them render everything at once, since they size to the viewport.
    if (documentHeight < contentHeight) {
      const grown = { width: req.viewportWidth, height: contentHeight };
      await page.setViewportSize(grown);
      await remoteDensity(grown);
      await page
        .waitForLoadState('networkidle', { timeout: budget(15_000) })
        .catch(() => {});
      await page.waitForTimeout(500);
    }

    // Second pass: banners that wait for an interaction or a scroll only show
    // up after the walk down the page.
    await dismissConsentBanner(page, budget(NAVIGATION_TIMEOUT_MS));
    // Most popups wait a few seconds, or for a scroll, before they open
    await dismissPopups(page, budget(NAVIGATION_TIMEOUT_MS));

    if (cdp) {
      return await remoteScreenshot(cdp, scale, {
        viewportWidth: req.viewportWidth,
        limitChars: canLaunchLocally() ? null : MAX_SERVERLESS_IMAGE_CHARS,
      });
    }

    if (scale > 1) {
      const fullHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      if (fullHeight * scale > MAX_SCREENSHOT_PX) throw new TooTallForScale();
    }

    const buffer = await page.screenshot({ fullPage: true, type: 'png' });
    const size = pngSize(buffer);
    // The image carries `scale` device px per CSS px; the viewer lays it out
    // at CSS size, which is what puts the extra pixels on a Retina screen
    return {
      image: `data:image/png;base64,${buffer.toString('base64')}`,
      width: Math.round(size.width / scale),
      height: Math.round(size.height / scale),
    };
  } finally {
    // A remote session may already be gone (timed out, dropped); closing the
    // context then throws, and must not mask the real error.
    await context.close().catch(() => {});
    await lease.release();
  }
}

/**
 * Capture at the lease's own scale, dropping to 1x for a page too tall for it.
 * Only a local browser captures above 1x, so the retry is taken there.
 */
async function captureAtBestScale(
  lease: BrowserLease,
  req: ScreenshotRequest,
  session: SavedSession | null = null,
): Promise<ScreenshotResult> {
  try {
    return await captureWith(lease, req, session);
  } catch (err) {
    if (!(err instanceof TooTallForScale)) throw err;
    return captureWith(await acquireLocalBrowser(), req, session, 1);
  }
}

function captureFailed(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(`Failed to capture screenshot: ${message}`);
}

/**
 * @param env the environment this one capture runs under — the route builds it
 * per request, so the browser can come from the deployment's token, from a key
 * the user typed into their own browser, or from this machine.
 */
export async function takeScreenshot(
  req: ScreenshotRequest,
  env: Record<string, string | undefined> = process.env,
): Promise<ScreenshotResult> {
  // A login saved on this machine only means anything to the browser on this
  // machine: the remote one would land on the login page, so take it from here
  const session = canLaunchLocally(env)
    ? await readSavedSession(req.url)
    : null;
  if (session) {
    try {
      return await captureAtBestScale(
        await acquireLocalBrowser(),
        req,
        session,
      );
    } catch (err) {
      throw captureFailed(err);
    }
  }
  try {
    return await captureAtBestScale(await acquireBrowser(env), req);
  } catch (err) {
    if (!(err instanceof RemoteBrowserUnsuitable)) throw captureFailed(err);
    // A serverless host has no browser of its own, so there is nothing here to
    // retry with and the caller gets the way out instead.
    if (!canLaunchLocally(env))
      throw captureFailed(new Error(err.message + err.hint));
    // As far as the target is concerned this machine is a different caller, and
    // its browser is already installed — take the capture from here. A second
    // refusal is the target's answer to us too, and is reported as it stands.
    try {
      return await captureAtBestScale(await acquireLocalBrowser(), req);
    } catch (retryErr) {
      throw captureFailed(retryErr);
    }
  }
}
