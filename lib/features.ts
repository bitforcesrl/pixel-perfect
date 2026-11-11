/**
 * Feature flags — one place to switch whole capabilities on or off.
 *
 * Each flag only decides what the UI *offers*; the API routes behind it stay
 * as they are, so turning a flag back on needs no other change.
 */

/**
 * Site capture through Browserless (the "Cloud" button, C / ⇧C, the
 * "Browserless key…" menu entry).
 *
 * Hidden for now: site captures are taken on the developer's own machine with
 * the local browser (L / ⇧L) and shared through the project ZIP. Set to `true`
 * to bring the cloud capture back everywhere at once.
 */
export const CLOUD_CAPTURE_ENABLED = false;
