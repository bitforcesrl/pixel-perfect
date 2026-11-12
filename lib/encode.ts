import { readAsDataUrl } from './image';
import { createJpegWriter, MAX_JPEG_SIDE } from './jpeg';
import { drawWhole, openRaster, type Raster } from './raster';
import {
  MAX_UNTILED_HEIGHT,
  TILE_HEIGHT,
  packTiles,
  type Tile,
} from './tile-container';

/**
 * WebP quality for stored layers. Lower than Squoosh's default (libwebp q75):
 * at 0.92 a re-encode in Squoosh still shaved ~40% off our output, and even
 * 0.75 spends bytes on detail nobody sees when aligning a screenshot to a
 * design.
 */
const QUALITY = 0.5;

/**
 * Where WebP is out of reach, JPEG at this quality: a PNG of a full-page 2x
 * capture runs to tens of megabytes, and that is what ends up in every export.
 */
const JPEG_QUALITY = 0.8;

/**
 * Safari refuses canvases past this area and hands back a blank one, so no
 * canvas here is ever made larger: big pictures are encoded strip by strip.
 */
const MAX_CANVAS_AREA = 16_777_216;

/** Rows drawn per band when streaming a JPEG — a multiple of 8, as JPEG codes. */
const BAND_HEIGHT = 256;

const WEBP = 'image/webp';
const JPEG = 'image/jpeg';

/** Let the page breathe between strips: a tall capture takes a few seconds. */
const yieldToPage = () => new Promise((resolve) => setTimeout(resolve, 0));

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  }).then((blob) => (blob?.type === type ? blob : null));
}

/** JPEG has no alpha: transparency would come out black, so lay white under it. */
function flattenOnWhite(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Encode what is on `canvas` as `type`, or — with no type asked — as WebP,
 * else JPEG (Safari draws WebP but won't encode it: toBlob hands back a PNG).
 */
async function encodeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  quality: number,
  type: string | null = null,
): Promise<Blob | null> {
  if (type !== JPEG) {
    const webp = await canvasBlob(canvas, WEBP, quality);
    if (webp || type === WEBP) return webp;
  }
  flattenOnWhite(ctx, canvas);
  return canvasBlob(canvas, JPEG, JPEG_QUALITY);
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return { canvas, ctx };
}

/** Whether the picture is small enough to stay one file. */
function fitsOneFile({
  width,
  height,
}: {
  width: number;
  height: number;
}): boolean {
  return height <= MAX_UNTILED_HEIGHT && width * height <= MAX_CANVAS_AREA;
}

/** A picture that fits one canvas, as one file. */
async function encodeSingle(
  raster: Raster,
  quality: number,
): Promise<Blob | null> {
  const { canvas, ctx } = createCanvas(raster.width, raster.height);
  await drawWhole(ctx, raster, 0, 0, raster.width, raster.height);
  return encodeCanvas(canvas, ctx, quality);
}

/** Rows per strip for a picture `width` px wide: within both canvas limits. */
function stripHeightFor(width: number): number {
  return Math.max(
    8,
    Math.min(TILE_HEIGHT, Math.floor(MAX_CANVAS_AREA / width / 8) * 8),
  );
}

/**
 * Paints the rows `top`…`top + rows` of the picture onto a cleared canvas of
 * exactly that height, at y 0.
 */
export type DrawStrip = (
  ctx: CanvasRenderingContext2D,
  top: number,
  rows: number,
) => Promise<void>;

/**
 * Encode a picture painted strip by strip: one file when it fits one, a strip
 * container otherwise — every strip WebP where the browser encodes it, JPEG
 * elsewhere (the first strip settles the format for the set). Only one strip
 * is ever held as pixels, so a picture of any height costs one canvas.
 *
 * Null when the browser would not encode a strip at all. `signal` stops it
 * between strips.
 */
export async function encodeStrips(
  width: number,
  height: number,
  draw: DrawStrip,
  {
    quality = QUALITY,
    signal,
  }: { quality?: number; signal?: AbortSignal } = {},
): Promise<Blob | null> {
  const single = fitsOneFile({ width, height });
  // Even strips, so the last one is never a sliver
  const count = single ? 1 : Math.ceil(height / stripHeightFor(width));
  const step = Math.ceil(height / count);

  const { canvas, ctx } = createCanvas(width, step);
  const tiles: Tile[] = [];
  let mime: string | null = null;
  for (let top = 0; top < height; top += step) {
    signal?.throwIfAborted();
    const rows = Math.min(step, height - top);
    // Resizing also clears; the full-size strips reuse the canvas as it is
    if (canvas.height !== rows) canvas.height = rows;
    else ctx.clearRect(0, 0, width, rows);
    await draw(ctx, top, rows);
    const blob = await encodeCanvas(canvas, ctx, quality, mime);
    if (!blob) return null;
    mime = blob.type;
    tiles.push({ height: rows, blob });
    await yieldToPage();
  }
  if (tiles.length === 1) return tiles[0].blob;
  return packTiles({ width, height, mime: mime ?? WEBP, tiles });
}

/**
 * A tall picture as a strip container, read from a raster. Only called for a
 * picture that does not fit one file, so `encodeStrips` always cuts it.
 */
function encodeTiled(raster: Raster, quality: number): Promise<Blob | null> {
  return encodeStrips(
    raster.width,
    raster.height,
    (ctx, top, rows) =>
      raster.draw(ctx, {
        sx: 0,
        sy: top,
        sw: raster.width,
        sh: rows,
        dx: 0,
        dy: 0,
        dw: raster.width,
        dh: rows,
      }),
    { quality },
  );
}

/**
 * Last resort, when the browser would not encode a strip: one JPEG written
 * band by band by our own encoder, on a white ground.
 */
async function streamJpeg(raster: Raster): Promise<Blob | null> {
  const { width, height } = raster;
  if (width > MAX_JPEG_SIDE || height > MAX_JPEG_SIDE) return null;
  const band = Math.max(
    8,
    Math.min(BAND_HEIGHT, Math.floor(MAX_CANVAS_AREA / width / 8) * 8),
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = band;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const jpeg = createJpegWriter(width, height, JPEG_QUALITY * 100);
  for (let top = 0; top < height; top += band) {
    const rows = Math.min(band, height - top);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, band);
    await raster.draw(ctx, {
      sx: 0,
      sy: top,
      sw: width,
      sh: rows,
      dx: 0,
      dy: 0,
      dw: width,
      dh: rows,
    });
    await jpeg.write(ctx.getImageData(0, 0, width, rows).data);
    await yieldToPage();
  }
  return jpeg.finish();
}

async function encodeCompact(
  src: string,
  quality: number,
): Promise<Blob | null> {
  try {
    const raster = await openRaster(src);
    if (raster.width === 0 || raster.height === 0) return null;
    const encoded = fitsOneFile(raster)
      ? await encodeSingle(raster, quality)
      : await encodeTiled(raster, quality);
    return encoded ?? (await streamJpeg(raster));
  } catch {
    return null;
  }
}

/**
 * The lightest faithful copy of `src` this browser can make: WebP at
 * `quality` (JPEG at 80% where WebP can't be encoded). A picture past one
 * file's worth — taller than a few thousand px, or past the canvas limit —
 * comes back as a strip container (`tile-container.ts`) of such files. Null
 * when the original is already lighter — a page of flat colour can be — or
 * when the image can't be decoded: the caller keeps the original then.
 * Browser only.
 */
export async function toCompactBlob(
  src: string,
  quality = QUALITY,
): Promise<Blob | null> {
  const encoded = await encodeCompact(src, quality);
  if (!encoded) return null;
  try {
    // Object and data URLs: no network, just the bytes already in memory
    const original = await (await fetch(src)).blob();
    return original.size > 0 && original.size <= encoded.size ? null : encoded;
  } catch {
    return encoded;
  }
}

/** `toCompactBlob` as a data URL, for what is stored as one. Browser only. */
export async function toCompactDataUrl(
  src: string,
  quality = QUALITY,
): Promise<string | null> {
  const blob = await toCompactBlob(src, quality);
  return blob ? readAsDataUrl(blob) : null;
}

/**
 * A small top-of-page thumbnail of `src` — what the page gallery shows.
 *
 * Full-page captures run thousands of pixels tall, so this keeps the top band
 * at the card's own ratio: that is the part which tells one page from another
 * at a glance. Null when the image can't be decoded.
 */
export async function toThumbnailDataUrl(
  src: string,
  width = 320,
  height = 200,
): Promise<string | null> {
  try {
    const raster = await openRaster(src);
    if (raster.width === 0 || raster.height === 0) return null;

    const { canvas, ctx } = createCanvas(width, height);
    const scale = width / raster.width;
    // Never sample past the bottom of an image shorter than the card
    const sourceHeight = Math.min(raster.height, height / scale);
    // Only the strips at the top are decoded
    await raster.draw(ctx, {
      sx: 0,
      sy: 0,
      sw: raster.width,
      sh: sourceHeight,
      dx: 0,
      dy: 0,
      dw: width,
      dh: sourceHeight * scale,
    });
    const webp = canvas.toDataURL(WEBP, 0.7);
    // toDataURL falls back to PNG where WebP is unsupported — either is fine
    // here, this is a thumbnail and not a layer anyone aligns against
    return webp.startsWith('data:image/') ? webp : null;
  } catch {
    return null;
  }
}
