export interface OffsetBounds {
  min: number;
  max: number;
}

/**
 * Vertical drag bounds for the Figma layer: keep at least part of it inside
 * the screenshot. `figmaHeight` is null until the export has been measured.
 */
export function offsetBounds(
  screenshotHeight: number,
  figmaHeight: number | null,
): OffsetBounds {
  return { min: -(figmaHeight ?? screenshotHeight), max: screenshotHeight };
}

export function clampOffset(
  offset: number,
  screenshotHeight: number,
  figmaHeight: number | null,
): number {
  const { min, max } = offsetBounds(screenshotHeight, figmaHeight);
  return Math.round(Math.min(max, Math.max(min, offset)));
}

/** Offset that aligns the Figma layer's bottom edge with the screenshot's. */
export function bottomAlignOffset(
  screenshotHeight: number,
  figmaHeight: number | null,
): number {
  return figmaHeight === null ? 0 : Math.round(screenshotHeight - figmaHeight);
}
