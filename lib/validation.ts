export interface ScreenshotResult {
  /**
   * Data URL of the full-page screenshot, as the Chrome extension sends it.
   * The workspace re-encodes it as WebP strips before storing it.
   */
  image: string;
  /** full-page width in CSS pixels */
  width: number;
  /** full-page height in CSS pixels */
  height: number;
}

/** Bounds of a viewport's width and height, in CSS pixels. */
export const MIN_DIM = 200;
export const MAX_DIM = 4000;
