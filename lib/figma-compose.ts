import type {FigmaLayer, FigmaRect, FigmaRender} from './figma';
import {createPngWriter} from './png';

/**
 * A sliced Figma render, put back together at full scale. Browser only.
 *
 * The parts are drawn into one band of the frame at a time, bottom layer
 * first, and each band goes straight into the PNG — so the frame is never
 * held as one bitmap, and its height is limited by nothing but memory for the
 * compressed file.
 */

/** Device px per band. */
const BAND_HEIGHT = 1024;
/** Parts downloaded at once. */
const DOWNLOADS = 6;
/** How many times a part Figma shrank is sliced again before it is stretched. */
const MAX_RESLICE_DEPTH = 3;
/**
 * Below this many device px a part is never one Figma shrank: its limit is far
 * above it. A small render that is smaller than its box is one Figma cropped
 * tighter — text, vectors, empty space — and is drawn as it is, never stretched.
 */
const MIN_SHRINKABLE_AREA = 4_000_000;
/**
 * Device px a side may miss its box by through Figma's own rounding of a
 * fractional box, shrunk or not.
 */
const ROUNDING_SLACK = 2;

/**
 * Whether Figma shrank a render of a `w` × `h` box down to `size`, rather than
 * cutting it differently from the box the API reported.
 *
 * Any shrink counts, however slight: a 375 × 8256 frame asked for at 2x comes
 * back at 99.2% — 745 × 16384 — and stretched back into place that is still
 * several px off by the bottom of the page, where every px is what the
 * comparison is about. A shrunk render is scaled down evenly, so both sides
 * miss by the same factor, to within rounding; a cropped one misses by
 * however much was cut from each side, which is never that even.
 */
export function wasShrunk(
  size: {width: number; height: number},
  w: number,
  h: number,
): boolean {
  if (w * h < MIN_SHRINKABLE_AREA) return false;
  // Both sides short of the box by more than rounding
  if (w - size.width <= ROUNDING_SLACK || h - size.height <= ROUNDING_SLACK) {
    return false;
  }
  // ...and by one factor, to within what rounding each side can add
  const byWidth = size.width / w;
  const byHeight = size.height / h;
  return Math.abs(byWidth - byHeight) <= ROUNDING_SLACK / w + ROUNDING_SLACK / h;
}

/** Figma's blend modes, where the canvas has the same one. */
const BLEND: Record<string, GlobalCompositeOperation> = {
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  COLOR_BURN: 'color-burn',
  LIGHTEN: 'lighten',
  SCREEN: 'screen',
  COLOR_DODGE: 'color-dodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'soft-light',
  HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity',
};

export interface ComposedRender {
  blob: Blob;
  /** Parts Figma rendered below the scale asked for, stretched into place */
  shrunk: number;
}

export interface ComposeIO {
  /** The bytes of one part's render */
  download: (url: string) => Promise<Blob>;
  /**
   * One part asked for again, in slices of its own. `maxArea` is the largest
   * render Figma has been seen to hand back unshrunk, when one has been.
   */
  slice: (nodeId: string, maxArea: number | null) => Promise<FigmaRender>;
}

type ImageLayer = Extract<FigmaLayer, {kind: 'image'}>;

/** Width and height from a PNG's header, without decoding it. */
async function pngSize(blob: Blob): Promise<{width: number; height: number}> {
  const head = new DataView(await blob.slice(0, 24).arrayBuffer());
  if (head.byteLength === 24 && head.getUint32(12) === 0x49484452 /* IHDR */) {
    return {width: head.getUint32(16), height: head.getUint32(20)};
  }
  const bitmap = await createImageBitmap(blob);
  const size = {width: bitmap.width, height: bitmap.height};
  bitmap.close();
  return size;
}

function intersect(a: FigmaRect | null, b: FigmaRect | null): FigmaRect | null {
  if (!a || !b) return a ?? b;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
}

function shift(rect: FigmaRect, dx: number, dy: number): FigmaRect {
  return {...rect, x: rect.x + dx, y: rect.y + dy};
}

/** Run `task` over `items`, a few at a time, keeping their order. */
async function pooled<T, R>(items: T[], task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({length: Math.min(DOWNLOADS, items.length)}, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

export async function composeFigmaRender(
  render: FigmaRender,
  io: ComposeIO,
): Promise<ComposedRender> {
  const {scale} = render;
  if (!render.layers || !render.width || !render.height) {
    throw new Error('Figma sent back no render');
  }
  const outWidth = Math.round(render.width * scale);
  const outHeight = Math.round(render.height * scale);

  // Figma shrinks a render until it fits its limit, so the area of a shrunk
  // one is that limit — the server slices by it from then on
  let maxArea: number | null = null;
  const blobs = new Map<FigmaLayer, Blob>();
  // Each part's render as Figma cut it, in device px
  const sizes = new Map<FigmaLayer, {width: number; height: number}>();
  const shrunk = new Set<FigmaLayer>();

  /**
   * Download every part and measure it. A part Figma shrank is asked for again
   * in slices, placed where it was, and those are measured in turn.
   */
  const resolve = async (
    layers: FigmaLayer[],
    depth: number,
  ): Promise<FigmaLayer[]> => {
    const measured = await pooled(layers, async (layer) => {
      if (layer.kind === 'fill') return null;
      const blob = await io.download(layer.url);
      blobs.set(layer, blob);
      const size = await pngSize(blob);
      sizes.set(layer, size);
      return size;
    });

    const out: FigmaLayer[] = [];
    for (const [index, layer] of layers.entries()) {
      const size = measured[index];
      if (layer.kind === 'fill' || !size) {
        out.push(layer);
        continue;
      }
      if (!wasShrunk(size, layer.rect.width * scale, layer.rect.height * scale)) {
        out.push(layer);
        continue;
      }
      const area = size.width * size.height;
      maxArea = maxArea === null ? area : Math.min(maxArea, area);
      if (!layer.splittable || depth >= MAX_RESLICE_DEPTH) {
        shrunk.add(layer);
        out.push(layer);
        continue;
      }
      blobs.delete(layer);
      out.push(...(await reslice(layer, depth)));
    }
    return out;
  };

  const reslice = async (
    part: ImageLayer,
    depth: number,
  ): Promise<FigmaLayer[]> => {
    const sub = await io.slice(part.id, maxArea);
    if (!sub.layers || sub.x === null || sub.y === null) {
      throw new Error('Figma sent back no slices');
    }
    // The slices come placed on the part's own frame: move them onto ours
    const dx = sub.x - render.x!;
    const dy = sub.y - render.y!;
    const placed = sub.layers.map((layer): FigmaLayer => ({
      ...layer,
      rect: shift(layer.rect, dx, dy),
      clip: intersect(
        layer.clip ? shift(layer.clip, dx, dy) : null,
        part.clip,
      ),
      alpha: layer.alpha * part.alpha,
    }));
    return resolve(placed, depth + 1);
  };

  if (render.x === null || render.y === null) {
    throw new Error('Figma sent back no frame position');
  }
  const layers = await resolve(render.layers, 0);

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('This browser has no 2D canvas');

  const png = createPngWriter(outWidth, outHeight);
  const decoded = new Map<FigmaLayer, ImageBitmap>();
  /**
   * How far down a part paints from its top, in device px: its render's own
   * height, which can run past the box Figma reported for it — measured by the
   * box, the overhang would be cut off at the next band's edge.
   */
  const reach = (layer: FigmaLayer) => {
    const box = layer.rect.height * scale;
    if (layer.kind === 'fill' || shrunk.has(layer)) return box;
    return Math.max(box, sizes.get(layer)?.height ?? 0);
  };

  for (let top = 0; top < outHeight; top += BAND_HEIGHT) {
    const bandHeight = Math.min(BAND_HEIGHT, outHeight - top);
    // Resizing clears it, and resets the state the last band left behind
    canvas.height = bandHeight;

    for (const layer of layers) {
      const y = layer.rect.y * scale;
      const h = layer.rect.height * scale;
      if (y + reach(layer) <= top || y >= top + bandHeight) continue;

      ctx.save();
      if (layer.clip) {
        ctx.beginPath();
        ctx.rect(
          layer.clip.x * scale,
          layer.clip.y * scale - top,
          layer.clip.width * scale,
          layer.clip.height * scale,
        );
        ctx.clip();
      }
      ctx.globalAlpha = layer.alpha;
      ctx.globalCompositeOperation =
        (layer.blend && BLEND[layer.blend]) || 'source-over';

      if (layer.kind === 'fill') {
        ctx.fillStyle = layer.color;
        ctx.fillRect(layer.rect.x * scale, y - top, layer.rect.width * scale, h);
      } else {
        let bitmap = decoded.get(layer);
        if (!bitmap) {
          bitmap = await createImageBitmap(blobs.get(layer)!);
          decoded.set(layer, bitmap);
        }
        // Pixel for pixel, unless Figma shrank it and it could not be sliced
        const stretch = shrunk.has(layer);
        ctx.drawImage(
          bitmap,
          Math.round(layer.rect.x * scale),
          Math.round(y) - top,
          stretch ? layer.rect.width * scale : bitmap.width,
          stretch ? h : bitmap.height,
        );
      }
      ctx.restore();
    }

    await png.write(ctx.getImageData(0, 0, outWidth, bandHeight).data);

    // Parts that end in this band are done with
    for (const [layer, bitmap] of decoded) {
      if (layer.rect.y * scale + reach(layer) <= top + bandHeight) {
        bitmap.close();
        decoded.delete(layer);
      }
    }
  }

  for (const bitmap of decoded.values()) bitmap.close();
  return {blob: await png.finish(), shrunk: shrunk.size};
}
