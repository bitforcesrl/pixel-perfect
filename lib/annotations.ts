/**
 * What gets drawn on top of both layers.
 *
 * Guides are the measuring tool: a bar you park against an edge in the Figma
 * export to see whether the site's edge lands on it. Strokes are the talking
 * tool: circle the thing that is wrong and hand over the screen. Both live in
 * the canvas's own pixels — above the capture and the export alike, belonging
 * to neither.
 */

export type GuideAxis = 'x' | 'y';

export interface Guide {
  id: string;
  /** 'x' is a vertical bar you slide left and right; 'y' a horizontal one. */
  axis: GuideAxis;
  /** Canvas px from the top left of the scrolled content. */
  pos: number;
  color: string;
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  /** Flat x,y pairs — cheaper to append to than an array of objects. */
  points: number[];
}

/** Cyan reads the site plate, magenta the Figma one — a guide is neither. */
export const DEFAULT_GUIDE_COLOR = '#ffd06b';
export const DEFAULT_PEN_COLOR = '#ff8080';
export const PEN_WIDTHS = [1, 2, 4, 8];

let counter = 0;

/** Unique enough for a React key: these never leave the session. */
export function annotationId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function clampGuide(pos: number, max: number): number {
  return Math.min(Math.max(pos, 0), Math.max(max, 0));
}

/** How far apart freshly dropped guides land, in canvas px. */
const GUIDE_SPACING = 32;

/**
 * Where a new guide goes: the middle of what is on screen, or — when a guide
 * of the same axis already sits there — the nearest free slot fanning out
 * from the middle. Always inside the visible span `[start, start + size]`, so
 * a guide is never dropped somewhere you cannot see it.
 */
export function freeGuidePos(
  taken: number[],
  start: number,
  size: number,
): number {
  const margin = Math.min(GUIDE_SPACING, size / 4);
  const lo = start + margin;
  const hi = start + size - margin;
  const center = start + size / 2;
  const clearance = (pos: number) =>
    taken.reduce((min, t) => Math.min(min, Math.abs(t - pos)), Infinity);

  for (let i = 0; ; i += 1) {
    // 0, +1, -1, +2, -2 … steps out from the middle
    const offset = Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1) * GUIDE_SPACING;
    const pos = center + offset;
    if (pos > hi && center - Math.abs(offset) < lo) break;
    if (pos < lo || pos > hi) continue;
    if (clearance(pos) >= GUIDE_SPACING / 2) return Math.round(pos);
  }

  // Every slot is crowded: take the spot furthest from any guide on screen
  let best = center;
  for (let pos = lo; pos <= hi; pos += 1) {
    if (clearance(pos) > clearance(best)) best = pos;
  }
  return Math.round(best);
}

/** An SVG path for one stroke. A single point still draws, as a dot. */
export function strokePath(stroke: Stroke): string {
  const { points } = stroke;
  if (points.length < 2) return '';
  let path = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    path += ` L ${points[i]} ${points[i + 1]}`;
  }
  // A tap with no travel would render nothing without somewhere to go
  if (points.length === 2) path += ` L ${points[0]} ${points[1]}`;
  return path;
}
