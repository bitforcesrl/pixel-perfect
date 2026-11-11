/**
 * Full-page captures, cut into horizontal strips for the canvas.
 *
 * A 2x desktop capture runs 2880 px wide and tens of thousands tall. As one
 * `<img>`, the browser has to decode the whole bitmap — hundreds of MB — before
 * it can paint any of it, and it drops that decode again when the tab goes to
 * the background or another viewport takes the cache. Until it is back, the
 * canvas paints black. Strips are decoded one at a time and only where they are
 * on screen, so switching viewport or coming back to the tab paints at once.
 *
 * Cutting is done once per image per session, in the background, one image at
 * a time so the peak memory is one decode rather than all of them. A picture
 * stored as a strip container (`tile-container.ts`) is already cut: its own
 * strips are shown as they are, with no decode and no re-encode at all.
 */

import { MAX_UNTILED_HEIGHT, TILE_HEIGHT, unpackTiles } from './tile-container';

/** Images kept cut. Four viewports with two layers each fit with room to spare. */
const CACHE_SIZE = 24;

export interface Strip {
  src: string;
  /** Natural px */
  height: number;
}

export interface Tiles {
  /** Natural px of the whole image */
  width: number;
  height: number;
  strips: Strip[];
}

interface Entry {
  promise: Promise<Tiles>;
  tiles: Tiles | null;
  /** Whether the strip URLs are ours to revoke — an uncut image is the caller's */
  owned: boolean;
}

const cache = new Map<string, Entry>();

interface Job {
  src: string;
  resolve: (tiles: Tiles) => void;
  reject: (err: unknown) => void;
}

const queue: Job[] = [];
let running = false;

function loadSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = src;
  });
}

async function cut(src: string): Promise<{ tiles: Tiles; owned: boolean }> {
  const blob = await (await fetch(src)).blob();
  const stored = await unpackTiles(blob);
  if (stored) {
    const strips = stored.tiles.map((tile) => ({
      src: URL.createObjectURL(tile.blob),
      height: tile.height,
    }));
    return {
      tiles: { width: stored.width, height: stored.height, strips },
      owned: true,
    };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    // Past what this browser will hold as a bitmap: draw it whole, as before
    const { width, height } = await loadSize(src);
    return {
      tiles: { width, height, strips: [{ src, height }] },
      owned: false,
    };
  }
  try {
    const { width, height } = bitmap;
    if (height <= MAX_UNTILED_HEIGHT) {
      return {
        tiles: { width, height, strips: [{ src, height }] },
        owned: false,
      };
    }
    // Even strips, so the last one is never a sliver
    const count = Math.ceil(height / TILE_HEIGHT);
    const step = Math.ceil(height / count);
    const strips: Strip[] = [];
    for (let y = 0; y < height; y += step) {
      const h = Math.min(step, height - y);
      const canvas = new OffscreenCanvas(width, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(bitmap, 0, y, width, h, 0, 0, width, h);
      // PNG: the strips are what gets aligned against, so no second lossy pass
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      strips.push({ src: URL.createObjectURL(blob), height: h });
    }
    return { tiles: { width, height, strips }, owned: true };
  } finally {
    bitmap.close();
  }
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    const entry = cache.get(job.src);
    try {
      const { tiles, owned } = await cut(job.src);
      if (entry && cache.get(job.src) === entry) {
        entry.tiles = tiles;
        entry.owned = owned;
      } else if (owned) {
        // Released while it was being cut: nobody will show these strips
        for (const strip of tiles.strips) URL.revokeObjectURL(strip.src);
      }
      job.resolve(tiles);
    } catch (err) {
      cache.delete(job.src);
      job.reject(err);
    }
  }
  running = false;
}

function release(src: string, entry: Entry): void {
  cache.delete(src);
  if (!entry.owned || !entry.tiles) return;
  for (const strip of entry.tiles.strips) URL.revokeObjectURL(strip.src);
}

/** Drop the least recently used images past the cap. */
function trim(): void {
  for (const [src, entry] of cache) {
    if (cache.size <= CACHE_SIZE) return;
    // One still being cut has a job waiting on it
    if (entry.tiles) release(src, entry);
  }
}

function request(src: string, urgent: boolean): Promise<Tiles> {
  const existing = cache.get(src);
  if (existing) {
    // Touch: the map's order is the LRU order
    cache.delete(src);
    cache.set(src, existing);
    if (urgent) {
      // The canvas is waiting on it — move it ahead of the background work
      const index = queue.findIndex((job) => job.src === src);
      if (index > 0) queue.unshift(...queue.splice(index, 1));
    }
    return existing.promise;
  }
  let job!: Job;
  const promise = new Promise<Tiles>((resolve, reject) => {
    job = { src, resolve, reject };
  });
  cache.set(src, { promise, tiles: null, owned: false });
  if (urgent) queue.unshift(job);
  else queue.push(job);
  trim();
  void drain();
  return promise;
}

/** The strips for `src`, cut ahead of anything queued in the background. */
export function loadTiles(src: string): Promise<Tiles> {
  return request(src, true);
}

/** Cut `src` when nothing more pressing is waiting, so it is ready when shown. */
export function prewarmTiles(src: string): void {
  request(src, false).catch(() => {});
}

/**
 * Forget `src`: its strips are freed now rather than when the cache fills up,
 * and a cut still waiting in the queue is skipped. Call it whenever a layer is
 * replaced or removed — a dropped export replaced by the next drop would
 * otherwise keep its decoded strips alive for the rest of the session.
 */
export function releaseTiles(src: string): void {
  const index = queue.findIndex((job) => job.src === src);
  if (index >= 0) {
    const [job] = queue.splice(index, 1);
    job.reject(new Error('Released before it was cut'));
  }
  const entry = cache.get(src);
  if (entry) release(src, entry);
}

/** The strips for `src` if they are already cut — lets a switch paint at once. */
export function peekTiles(src: string): Tiles | null {
  return cache.get(src)?.tiles ?? null;
}
