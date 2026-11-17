/**
 * Functions that run inside the page being captured.
 *
 * Each one is sent to the page as its own source text through
 * `Runtime.evaluate` (see {@link evalExpression}), so it must be entirely
 * self-contained: no imports, no module-level helpers, arguments as JSON.
 * They are ported from the app's server-side capture (`lib/screenshot.ts`),
 * with one deliberate difference: nothing here clicks. The page runs in the
 * user's own profile, and accepting a cookie banner or dismissing a popup
 * there would be a choice made on their behalf. Overlays are hidden instead.
 */

/** `(fn)(arg1, arg2…)` with the arguments as JSON literals. */
export function evalExpression(fn, ...args) {
  return `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(', ')})`;
}

/**
 * Hide the bar Shopify injects while a theme is being previewed. Removed, not
 * clicked: its own controls lead into the theme editor.
 */
export function hideShopifyPreviewBar() {
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
  let removed = 0;
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      el.remove();
      removed++;
    }
  }
  return removed;
}

/**
 * Hide every cookie banner and popup standing over the page.
 *
 * A consent layer is something fixed or sticky to the viewport whose names say
 * it is one (the vendors' own ids and classes). A popup is something fixed
 * that says it is a dialog or names itself like a newsletter, promo or modal;
 * the weak names only count when it covers the middle of the viewport, which a
 * sticky header never does. Outermost matches only, and only hidden: the
 * user's consent and the site's state stay exactly as they were.
 */
export function hideOverlays() {
  const CONSENT_NAMES =
    /cookie|consent|gdpr|ccpa|onetrust|cybot|didomi|usercentrics|iubenda|osano|cky-|termly|klaro|borlabs|complianz|cookiescript|axeptio|trustarc|truste|quantcast|qc-cmp|shopify-pc/i;
  const STRONG_NAMES =
    /newsletter|popup|pop-up|klaviyo|privy|omnisend|mailchimp|signup|sign-up|subscribe|discount|promo|lightbox|optinmonster|justuno|wisepops|attentive|spin-?wheel|exit-?intent/i;
  const WEAK_NAMES = /modal|overlay|backdrop|dialog/i;
  const DIALOG =
    'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';

  const walk = (root, out) => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };

  const parentOf = (el) => {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  };

  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    const style = getComputedStyle(el);
    return (
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0.05
    );
  };

  /** Fixed or sticky to the viewport, itself or through an ancestor. */
  const pinned = (el) => {
    for (let node = el; node; node = parentOf(node)) {
      if (node === document.body || node === document.documentElement) break;
      const position = getComputedStyle(node).position;
      if (position === 'fixed' || position === 'sticky') return true;
    }
    return false;
  };

  const names = (el) =>
    [
      el.id,
      typeof el.className === 'string' ? el.className : '',
      el.tagName,
      el.getAttribute('data-testid') || '',
      el.getAttribute('data-section-type') || '',
      el.getAttribute('aria-label') || '',
    ].join(' ');

  const coversMiddle = (el) => {
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

  const isOverlay = (el) => {
    if (el === document.body || el === document.documentElement) return false;
    if (el.tagName === 'HEADER' || el.tagName === 'NAV') return false;
    const named = names(el);
    const consent = CONSENT_NAMES.test(named);
    const strong = STRONG_NAMES.test(named);
    const dialog = el.matches(DIALOG) || WEAK_NAMES.test(named);
    if (!consent && !strong && !dialog) return false;
    if (!visible(el) || !pinned(el)) return false;
    return consent || strong || coversMiddle(el);
  };

  const all = walk(document, []);
  const overlays = all.filter(isOverlay);
  const outer = overlays.filter((el) => {
    for (let node = parentOf(el); node; node = parentOf(node)) {
      if (overlays.includes(node)) return false;
    }
    return true;
  });
  for (const el of outer) {
    el.style.setProperty('display', 'none', 'important');
  }
  return outer.length;
}

/**
 * Make the document itself the scroller, so a full-page capture sees the whole
 * page. Smooth-scroll libraries (Locomotive, Lenis, ScrollSmoother) and
 * `overflow: auto` wrappers keep the content inside a container the size of
 * the viewport; those are unwrapped, small scrollable widgets are left alone.
 */
export function unwrapScrollContainers() {
  const html = document.documentElement;
  const important = (el, prop, value) =>
    el.style.setProperty(prop, value, 'important');

  for (const root of [html, document.body]) {
    if (!root) continue;
    important(root, 'height', 'auto');
    important(root, 'min-height', '0');
    important(root, 'max-height', 'none');
    important(root, 'overflow', 'visible');
  }

  for (const el of Array.from(document.querySelectorAll('*'))) {
    const style = getComputedStyle(el);
    const overflows = el.scrollHeight > el.clientHeight + 50;
    const clips = ['hidden', 'auto', 'scroll', 'clip'].includes(
      style.overflowY,
    );
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
    important(el, 'transform', 'none');
    for (const child of Array.from(el.children)) {
      important(child, 'transform', 'none');
    }
  }
}

/**
 * Paint everything now: `content-visibility` and `loading="lazy"` leave
 * correctly sized but empty boxes below the fold. Waits up to `budgetMs` for
 * the images to arrive.
 */
export async function forceEagerRendering(budgetMs) {
  if (!document.getElementById('__pp-eager')) {
    const style = document.createElement('style');
    style.id = '__pp-eager';
    style.textContent = `*, *::before, *::after {
      content-visibility: visible !important;
      contain-intrinsic-size: auto !important;
    }`;
    (document.head || document.documentElement).appendChild(style);
  }
  for (const el of Array.from(document.querySelectorAll('[loading="lazy"]'))) {
    el.setAttribute('loading', 'eager');
  }
  for (const img of Array.from(document.images)) {
    img.decoding = 'sync';
    if (!img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
    if (!img.getAttribute('srcset') && img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
    }
  }
  const pending = Array.from(document.images)
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    );
  await Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, budgetMs)),
  ]);
}

/**
 * Walk the page top to bottom so every lazy section renders, sit at the bottom
 * until the height stops changing, then go back to the top. The height is
 * re-read on every step: sections that render on intersection reveal the next.
 */
export async function scrollUntilSettled(budgetMs) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  const until = Date.now() + budgetMs;
  let guard = 0;

  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    if (guard++ > 400 || Date.now() > until) break;
    window.scrollTo(0, y);
    await sleep(250);
  }

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
}

/** Height of the rendered content, including whatever still overflows. */
export function measureContentHeight() {
  let height = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
  for (const el of Array.from(document.querySelectorAll('*'))) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    height = Math.max(height, top + el.scrollHeight);
  }
  return Math.ceil(height);
}

/**
 * True when the page is a password gate rather than the page: the document
 * was refused (401/403) and asks for a password. The extension never types
 * one in; the user enters it in their own browser first.
 */
export function findPasswordGate() {
  const [navigation] = performance.getEntriesByType('navigation');
  const status = navigation ? navigation.responseStatus : 0;
  if (status !== 401 && status !== 403) return false;
  return document.querySelector('input[type="password"]') !== null;
}
