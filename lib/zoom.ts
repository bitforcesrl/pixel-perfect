import type { ViewMode } from "./types";

/** The zoom stops, the ones the +/− keys and the palette's presets land on. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Next preset above (dir 1) or below (dir -1) the current zoom. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const steps = dir === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
  return (
    steps.find((step) => (dir === 1 ? step > zoom + 0.001 : step < zoom - 0.001)) ??
    zoom
  );
}

/** Keep a free-typed or dragged zoom inside the range the canvas can render. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Zoom a view lands on when it opens — a starting point, not a lock: the zoom
 * controls take over from there. A wide viewport side by side is the one case
 * two panes cannot fit at 1:1, so it starts halved.
 */
export function defaultZoom(mode: ViewMode, viewportWidth: number): number {
  return mode === "sideBySide" && viewportWidth >= SIDE_BY_SIDE_HALVED_FROM
    ? 0.5
    : 1;
}

/** Narrower than this, two panes of the viewport still fit a laptop at 1:1. */
const SIDE_BY_SIDE_HALVED_FROM = 1024;
