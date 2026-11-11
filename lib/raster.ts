import { unpackTiles, type TileSet } from './tile-container';

/**
 * One way to read pixels, whatever holds them: an ordinary image file or a
 * strip container (`tile-container.ts`). Diffing, thumbnails and re-encoding
 * draw through this and never need to know which they were handed.
 * Browser only.
 */

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A source rectangle and the destination it is drawn into, in px. */
export interface DrawRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface Raster {
  /** Natural px of the whole picture */
  readonly width: number;
  readonly height: number;
  /** `drawImage` with a source rect, across strips when there are several. */
  draw(ctx: Context2D, rect: DrawRect): Promise<void>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = src;
  });
}

/**
 * A plain image file. Decoded through `<img>` rather than a bitmap: browsers
 * draw an `<img>` far past the size `createImageBitmap` agrees to hold.
 */
function imageRaster(img: HTMLImageElement): Raster {
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    async draw(ctx, r) {
      ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    },
  };
}

/**
 * A strip container. Each strip is decoded only when a draw reaches it, and
 * dropped right after, so the peak is one strip — never the whole picture.
 */
function tileRaster(set: TileSet): Raster {
  return {
    width: set.width,
    height: set.height,
    async draw(ctx, r) {
      const scaleY = r.dh / r.sh;
      let top = 0;
      for (const tile of set.tiles) {
        const bottom = top + tile.height;
        // The part of the source rect this strip covers, if any
        const from = Math.max(r.sy, top);
        const to = Math.min(r.sy + r.sh, bottom);
        if (to > from) {
          // Edges rounded the same way on both sides of every seam, so
          // neighbouring strips meet with no gap and no overlap when scaled
          const y0 = Math.round(r.dy + (from - r.sy) * scaleY);
          const y1 = Math.round(r.dy + (to - r.sy) * scaleY);
          if (y1 > y0) {
            const bitmap = await createImageBitmap(tile.blob);
            try {
              ctx.drawImage(
                bitmap,
                r.sx,
                from - top,
                r.sw,
                to - from,
                r.dx,
                y0,
                r.dw,
                y1 - y0,
              );
            } finally {
              bitmap.close();
            }
          }
        }
        if (bottom >= r.sy + r.sh) break;
        top = bottom;
      }
    },
  };
}

/**
 * Open the picture behind an object or data URL for drawing, whichever kind
 * it holds. Those URLs never hit the network: the bytes are already here.
 */
export async function openRaster(src: string): Promise<Raster> {
  const set = await unpackTiles(await (await fetch(src)).blob());
  return set ? tileRaster(set) : imageRaster(await loadImage(src));
}

/** Draw the whole of `raster` into the given destination rect. */
export function drawWhole(
  ctx: Context2D,
  raster: Raster,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): Promise<void> {
  return raster.draw(ctx, {
    sx: 0,
    sy: 0,
    sw: raster.width,
    sh: raster.height,
    dx,
    dy,
    dw,
    dh,
  });
}
