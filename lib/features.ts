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
 * On everywhere. Like the Figma export, the key comes from the deployment's
 * `BROWSERLESS_TOKEN` when it has one (a developer's machine), and otherwise
 * from the user, who is asked for their own browserless.io key the first time
 * they capture (a public deployment such as Vercel). Set to `false` to hide
 * the cloud capture everywhere at once; the local browser (L / ⇧L) is
 * unaffected.
 */
export const CLOUD_CAPTURE_ENABLED = true;
