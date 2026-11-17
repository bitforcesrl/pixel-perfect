/**
 * How a viewport is emulated: its size, its pixel density and whether it is a
 * phone.
 *
 * The density follows the app's `lib/render-scale.ts` exactly (a test holds
 * the two together): 2x for a mobile layout, sliding to 1x at desktop width,
 * so a capture and a Figma export of the same viewport carry the same pixels.
 */

/** Widths up to this many CSS px are captured at the highest density. */
const HIGH_DENSITY_UP_TO = 448;
/** Widths from this many CSS px up are captured at 1x. */
const LOW_DENSITY_FROM = 1440;
const MAX_RENDER_SCALE = 2;
const MIN_RENDER_SCALE = 1;
const SCALE_STEP = 0.25;

/** Below this width the page is shown a phone: mobile UA, touch, mobile viewport. */
export const MOBILE_BELOW = 768;

/**
 * Chrome on a current Android phone. Some themes decide "mobile" on the user
 * agent rather than the width, and would otherwise serve a desktop header in a
 * 375 px window.
 */
export const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export function renderScaleFor(cssWidth) {
  if (!Number.isFinite(cssWidth) || cssWidth <= HIGH_DENSITY_UP_TO) {
    return MAX_RENDER_SCALE;
  }
  if (cssWidth >= LOW_DENSITY_FROM) return MIN_RENDER_SCALE;
  const t =
    (cssWidth - HIGH_DENSITY_UP_TO) / (LOW_DENSITY_FROM - HIGH_DENSITY_UP_TO);
  const raw = MAX_RENDER_SCALE - t * (MAX_RENDER_SCALE - MIN_RENDER_SCALE);
  return Math.round(raw / SCALE_STEP) * SCALE_STEP;
}

/** Everything `Emulation.*` needs to show the page at one viewport. */
export function emulationFor({ width, height }) {
  const mobile = width < MOBILE_BELOW;
  return {
    metrics: {
      width,
      height,
      deviceScaleFactor: renderScaleFor(width),
      mobile,
    },
    userAgent: mobile ? MOBILE_UA : null,
    touch: mobile,
  };
}
