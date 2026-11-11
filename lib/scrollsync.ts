/**
 * Scroll positions that keep the two side-by-side panes on the same part of the
 * page. `offsetY` is in image pixels and pushes the Figma layer down, so the
 * Figma content aligned with site scroll `S` sits at `S - offsetY * zoom`.
 * Both clamp at 0; the browser clamps the far end.
 */
export function figmaScrollTop(
  siteTop: number,
  offsetY: number,
  zoom: number,
): number {
  return Math.max(0, siteTop - offsetY * zoom);
}

export function siteScrollTop(
  figmaTop: number,
  offsetY: number,
  zoom: number,
): number {
  return Math.max(0, figmaTop + offsetY * zoom);
}

/** Where a view is looking, in image px of the capture. */
export interface ScrollPos {
  top: number;
  left: number;
}
