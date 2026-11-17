/**
 * Sizing of a full-page capture.
 *
 * Chrome draws a `captureBeyondViewport` screenshot through one GPU texture,
 * and a texture past ~16k device px comes back with repeated or blank bands.
 * So a tall page is taken in slices no taller than {@link SLICE_MAX} and
 * stitched on a canvas, which has limits of its own: no side over
 * {@link CANVAS_MAX} and no more than {@link CANVAS_MAX_AREA} pixels. A page
 * too large for the canvas at its density is taken at 1x instead.
 */

export const CANVAS_MAX = 32767;
export const CANVAS_MAX_AREA = 268435456;
export const SLICE_MAX = 8192;
/** Tallest capture, in CSS px, so a runaway page cannot exhaust memory. */
export const MAX_CAPTURE_HEIGHT = 30000;

/** `scale` when the stitched image fits a canvas at it, otherwise 1. */
export function fitScale(cssWidth, cssHeight, scale) {
  if (scale <= 1) return scale;
  const width = Math.ceil(cssWidth * scale);
  const height = Math.ceil(cssHeight * scale);
  const fits =
    width <= CANVAS_MAX &&
    height <= CANVAS_MAX &&
    width * height <= CANVAS_MAX_AREA;
  return fits ? scale : 1;
}

/** Contiguous `{ y, height }` bands in CSS px covering the capped page. */
export function planSlices(cssHeight, scale) {
  const total = Math.min(Math.ceil(cssHeight), MAX_CAPTURE_HEIGHT);
  // Densities come in quarter steps, so a band a multiple of 4 CSS px tall is
  // a whole number of device px: no half-pixel seams between slices.
  const step = Math.max(4, Math.floor(SLICE_MAX / scale / 4) * 4);
  const slices = [];
  for (let y = 0; y < total; y += step) {
    slices.push({ y, height: Math.min(step, total - y) });
  }
  return slices;
}
