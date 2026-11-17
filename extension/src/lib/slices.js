/**
 * Sizing of a full-page capture.
 *
 * Chrome draws a `captureBeyondViewport` screenshot through one GPU texture,
 * and a texture past ~16k device px comes back with repeated or blank bands.
 * So a tall page is taken in slices no taller than {@link SLICE_MAX} device
 * px, and every slice is cut into strips, each its own WebP (`stitch.js`).
 * The page is never stitched into one picture, so no canvas limit caps its
 * height or its density.
 */

export const SLICE_MAX = 8192;
/** Tallest capture, in CSS px, so a runaway page cannot exhaust memory. */
export const MAX_CAPTURE_HEIGHT = 30000;

/**
 * Slices for a page `cssHeight` CSS px tall at `scale`, each a whole number of
 * strips (the last excepted), so every strip is cut from one slice.
 *
 * A strip is `stripHeight` natural px at most: its CSS height is the largest
 * multiple of 4 that fits, so at a quarter-step scale every strip is a whole
 * number of device px and no row is cut in two.
 *
 * @returns `{ slices, stripCss }`: contiguous `{ y, height }` bands in CSS px
 *   covering the capped page, and the CSS height of one full strip
 */
export function planStripSlices(cssHeight, scale, stripHeight) {
  const stripCss = Math.max(4, Math.floor(stripHeight / scale / 4) * 4);
  const perSlice = Math.max(1, Math.floor(SLICE_MAX / scale / stripCss));
  const step = stripCss * perSlice;
  const total = Math.min(Math.ceil(cssHeight), MAX_CAPTURE_HEIGHT);
  const slices = [];
  for (let y = 0; y < total; y += step) {
    slices.push({ y, height: Math.min(step, total - y) });
  }
  return { slices, stripCss };
}
