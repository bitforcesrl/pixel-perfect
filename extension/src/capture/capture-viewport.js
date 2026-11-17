/**
 * One viewport of one page, over the DevTools protocol.
 *
 * The tab belongs to a window the extension opened for the capture, in the
 * user's own profile: their logins, shop passwords and cookie choices are
 * already there. The page is shown at the viewport's size and density (a
 * phone below 768 px), loaded, prepared the way the app's server-side capture
 * prepares it (lazy content, scroll containers, overlays hidden), then shot in
 * slices and cut into WebP strips.
 */
import { emulationFor } from '../lib/emulation.js';
import { MAX_CAPTURE_HEIGHT, planStripSlices } from '../lib/slices.js';
import {
  evalExpression,
  findPasswordGate,
  forceEagerRendering,
  hideOverlays,
  hideShopifyPreviewBar,
  measureContentHeight,
  scrollUntilSettled,
  unwrapScrollContainers,
} from './page-scripts.js';
import { encodeStrips } from './stitch.js';

const LOAD_TIMEOUT_MS = 30_000;
const SETTLE_AFTER_LOAD_MS = 1_500;
const IMAGE_WAIT_MS = 10_000;
const SCROLL_PASS_MS = 120_000;

export const PASSWORD_GATE_MESSAGE =
  'This site asks for a password. Open it in Chrome, enter the password, then capture again.';

export class CaptureAborted extends Error {
  constructor() {
    super('Capture stopped');
    this.name = 'AbortError';
  }
}

export class CaptureTimedOut extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(cdp, fn, ...args) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression: evalExpression(fn, ...args),
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) {
    throw new Error(
      exceptionDetails.exception?.description ?? exceptionDetails.text,
    );
  }
  return result?.value;
}

/** Resolves with the event's params, or null once `ms` has passed. */
function waitForEvent(cdp, method, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, ms);
    const stop = cdp.onEvent(method, (params) => {
      clearTimeout(timer);
      stop();
      resolve(params);
    });
  });
}

/**
 * Page zoom back to 100%, when the session can do it. A failure is not fatal
 * on its own: the width check right after reports a viewport that still came
 * out wrong, with a way forward.
 */
async function resetZoom(cdp) {
  if (typeof cdp.resetZoom !== 'function') return;
  try {
    await cdp.resetZoom();
  } catch (err) {
    if (cdp.detached) throw err;
    console.warn('Pixel Perfect: could not reset the page zoom', err);
  }
}

async function applyMetrics(cdp, metrics) {
  await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
}

/**
 * @param cdp an attached session (see `cdp.js`)
 * @param request `{ url, viewport: { key, width, height, scale }, encoding:
 *   { quality, stripHeight } }`
 * @param control `{ deadline, signal }`: steps that are only nice to have are
 *   cut short or skipped once the deadline is near; the screenshot itself is
 *   always taken once the page has loaded, since part of a page beats none.
 * @returns `{ width, height }` in CSS px, `strips`, `pixelWidth` and
 *   `pixelHeight` (`stitch.js`)
 */
export async function captureViewport(
  cdp,
  { url, viewport, encoding },
  control,
) {
  const { deadline, signal } = control;
  const left = () => deadline - Date.now();
  const check = () => {
    if (signal?.aborted) throw new CaptureAborted();
    if (left() <= 0) throw new CaptureTimedOut('Timed out');
  };
  const within = (ms) => Math.max(0, Math.min(ms, left() - 5_000));

  const { metrics, userAgent, touch } = emulationFor(viewport);

  // 1. Show the page as the viewport, before it loads anything
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await applyMetrics(cdp, metrics);
  // An empty override puts the browser's own user agent back, undoing the
  // mobile one an earlier viewport set on the same tab
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: userAgent ?? '',
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: touch,
    maxTouchPoints: touch ? 5 : 1,
  });
  await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });
  // A page that thinks it lost focus may pause its animations and loaders
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  check();

  // 2. Load it
  const loaded = waitForEvent(
    cdp,
    'Page.loadEventFired',
    Math.min(LOAD_TIMEOUT_MS, Math.max(1_000, left())),
  );
  const { errorText } = await cdp.send('Page.navigate', { url });
  if (errorText) throw new Error(`The page could not be loaded (${errorText})`);
  await loaded;
  check();
  // The user's page zoom for this site would scale the CSS viewport (90%
  // turns 1440 px into 1600 px). Every navigation brings the site's zoom
  // back, so it is reset after each load
  await resetZoom(cdp);
  // Some themes resize themselves on load; put the viewport back if so
  await applyMetrics(cdp, metrics);
  let innerWidth = await evaluate(cdp, () => window.innerWidth);
  if (innerWidth !== viewport.width) {
    await resetZoom(cdp);
    await applyMetrics(cdp, metrics);
    await sleep(100);
    innerWidth = await evaluate(cdp, () => window.innerWidth);
    if (innerWidth !== viewport.width) {
      throw new Error(
        `The page would not render at ${viewport.width} px (got ${innerWidth} px). ` +
          'If Chrome zooms this site, set its zoom back to 100% and capture again.',
      );
    }
  }

  // 3. A password gate is not the page: the user has to pass it themselves
  if (await evaluate(cdp, findPasswordGate)) {
    throw new Error(PASSWORD_GATE_MESSAGE);
  }

  // 4. Prepare: overlays out of the way, everything lazy rendered
  await sleep(within(SETTLE_AFTER_LOAD_MS));
  check();
  await evaluate(cdp, hideOverlays);
  await evaluate(cdp, hideShopifyPreviewBar);
  await evaluate(cdp, unwrapScrollContainers);
  if (within(IMAGE_WAIT_MS) > 0) {
    await evaluate(cdp, forceEagerRendering, within(IMAGE_WAIT_MS));
  }
  check();
  if (within(SCROLL_PASS_MS) > 0) {
    await evaluate(cdp, scrollUntilSettled, within(SCROLL_PASS_MS));
  }
  check();
  await evaluate(cdp, unwrapScrollContainers);
  if (within(IMAGE_WAIT_MS) > 0) {
    await evaluate(cdp, forceEagerRendering, within(IMAGE_WAIT_MS));
  }
  await sleep(within(500));
  // Popups that waited for a scroll or a few seconds are up by now
  await evaluate(cdp, hideOverlays);
  if (signal?.aborted) throw new CaptureAborted();

  // 5. Content trapped in a container that would not unwrap: grow the
  //    viewport to it, since such containers size to the viewport
  const contentHeight = Math.min(
    await evaluate(cdp, measureContentHeight),
    MAX_CAPTURE_HEIGHT,
  );
  const documentHeight = await evaluate(
    cdp,
    () => document.documentElement.scrollHeight,
  );
  if (documentHeight < contentHeight) {
    await applyMetrics(cdp, { ...metrics, height: contentHeight });
    await sleep(Math.max(250, within(1_000)));
  }

  // 6. Final size: the asked density holds at any height, strips are
  //    never stitched into one picture
  const scale = metrics.deviceScaleFactor;
  const { cssContentSize } = await cdp.send('Page.getLayoutMetrics');
  const width = Math.max(Math.ceil(cssContentSize.width), viewport.width);
  const height = Math.min(
    Math.max(contentHeight, Math.ceil(cssContentSize.height)),
    MAX_CAPTURE_HEIGHT,
  );

  // 7. Shoot slice by slice, lossless; then each strip is encoded once,
  //    straight to what the app stores
  const { slices: plan, stripCss } = planStripSlices(
    height,
    scale,
    encoding.stripHeight,
  );
  const slices = [];
  for (const slice of plan) {
    if (signal?.aborted) throw new CaptureAborted();
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: slice.y, width, height: slice.height, scale: 1 },
    });
    slices.push({ base64: data, ...slice });
  }
  const encoded = await encodeStrips(slices, {
    stripRows: Math.round(stripCss * scale),
    quality: encoding.quality,
    signal,
  });
  if (signal?.aborted) throw new CaptureAborted();
  if (encoded.strips.length === 0) {
    throw new Error('The page came out empty: nothing to capture');
  }
  return { ...encoded, width, height };
}
