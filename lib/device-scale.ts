/**
 * The device pixel ratio a screenshot was taken at, read back from its size.
 *
 * A capture made by the app records its size in CSS px and carries `scale`
 * device px per CSS px (`render-scale.ts`). A screenshot dropped from disk
 * carries no such note: a 750 px wide phone shot is a 375 px layout at 2x.
 * Treating it as 1x would show it twice as large as a capture of the same
 * page and count every offset in device px instead of CSS px — so the scale
 * is recovered from how its width relates to the viewport it was dropped on.
 * Pure.
 */

/**
 * The ratios real screens and screenshot tools use. Anything else is not a
 * scaled shot of this viewport, and is taken as it is.
 */
const KNOWN_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/**
 * How far, in CSS px, a shot's width may stray from the viewport's and still
 * be a shot of it: a full-page screenshot can lose or gain a scrollbar
 * (~15 px). Counted in CSS px rather than as a percentage, so a desktop shot
 * dropped on a phone viewport is never mistaken for a high-density phone shot.
 */
const TOLERANCE_CSS_PX = 16;

/**
 * Device px per CSS px for an image `imageWidth` px wide shot of a layout
 * `cssWidth` CSS px wide: the known ratio that brings it closest to the
 * layout, if within tolerance, else 1 — a picture that matches none is shown
 * at its own pixel size.
 */
export function inferDeviceScale(imageWidth: number, cssWidth: number): number {
  if (!(imageWidth > 0) || !(cssWidth > 0)) return 1;
  let best = 1;
  let bestError = Infinity;
  for (const scale of KNOWN_SCALES) {
    const error = Math.abs(imageWidth / scale - cssWidth);
    if (error < bestError) {
      best = scale;
      bestError = error;
    }
  }
  return bestError <= TOLERANCE_CSS_PX ? best : 1;
}
