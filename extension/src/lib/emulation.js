/**
 * How a viewport is emulated: its size, its pixel density and whether it is a
 * phone.
 *
 * The density is the one the app asks for (`lib/render-scale.ts`, from the
 * width and the screen the app runs on), so a capture and a Figma export of
 * the same viewport carry the same pixels.
 */

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

/** Everything `Emulation.*` needs to show the page at one viewport. */
export function emulationFor({ width, height, scale }) {
  const mobile = width < MOBILE_BELOW;
  return {
    metrics: {
      width,
      height,
      deviceScaleFactor: scale,
      mobile,
    },
    userAgent: mobile ? MOBILE_UA : null,
    touch: mobile,
  };
}
