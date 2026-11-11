/**
 * How many device px per CSS px a capture or a Figma export is rendered at,
 * chosen from the layout's width.
 *
 * 2x pays off on small layouts: a mobile page is narrow, so it gets zoomed in
 * a lot to be checked, and the extra pixels are what keep it sharp. A desktop
 * layout is already wide on screen and is rarely looked at past 100%, so its
 * 2x pixels are mostly bytes — four times as many as at 1x, in every capture,
 * every stored layer and every export. In between, the scale slides linearly
 * from one to the other. Pure, shared by the server (screenshots, Figma
 * renders) and the browser.
 */

/**
 * At or below this CSS width, the full high-density scale: 448 is the widest
 * phone layout in common use (Pixel Pro XL class), so every phone gets 2x.
 */
export const HIGH_DENSITY_UP_TO = 448;
/** At or above this CSS width, plain 1x. */
export const LOW_DENSITY_FROM = 1440;

export const MAX_RENDER_SCALE = 2;
export const MIN_RENDER_SCALE = 1;

/**
 * Scales snap to quarter steps: the densities real screens use (1.25, 1.5,
 * 1.75), and sizes that multiply out cleanly instead of odd fractions that
 * blur every edge by a sub-pixel.
 */
const SCALE_STEP = 0.25;

/** The render scale for a layout `cssWidth` CSS px wide. */
export function renderScaleFor(cssWidth: number): number {
  if (!Number.isFinite(cssWidth) || cssWidth <= HIGH_DENSITY_UP_TO) {
    return MAX_RENDER_SCALE;
  }
  if (cssWidth >= LOW_DENSITY_FROM) return MIN_RENDER_SCALE;
  // 0 at the mobile end, 1 at the desktop end
  const t =
    (cssWidth - HIGH_DENSITY_UP_TO) / (LOW_DENSITY_FROM - HIGH_DENSITY_UP_TO);
  const raw = MAX_RENDER_SCALE - t * (MAX_RENDER_SCALE - MIN_RENDER_SCALE);
  return Math.round(raw / SCALE_STEP) * SCALE_STEP;
}

/**
 * A scale sent by a client, if it is one this module could have produced;
 * null otherwise, so the caller works it out again rather than trusting it.
 */
export function parseRenderScale(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < MIN_RENDER_SCALE || value > MAX_RENDER_SCALE) return null;
  return Math.round(value / SCALE_STEP) * SCALE_STEP;
}
