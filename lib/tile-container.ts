/**
 * A tall picture kept as a column of independently encoded strips, packed in
 * one Blob.
 *
 * WebP cannot hold more than 16383 px a side, and a full-page 2x capture runs
 * far past that. Rather than falling back to a heavy JPEG, the picture is cut
 * into horizontal strips, each a small WebP, and the strips travel together as
 * a single Blob — so storage, history and data URLs keep handling "one image"
 * exactly as before. Whatever needs pixels opens it through `raster.ts`; the
 * canvas shows the strips as they are, with nothing left to cut at runtime.
 *
 * Layout, big-endian:
 *
 *   "PPTL"  magic                         4 bytes
 *   version                               1 byte
 *   mime length (n)                       1 byte
 *   width, height, strip count            3 x u32
 *   mime of every strip, ASCII            n bytes
 *   per strip: height, byte length        count x 2 x u32
 *   strip bytes, top to bottom            the rest
 *
 * Pure: nothing here touches the DOM, only Blob.
 */

/** MIME of the container itself — what `Blob.type` and data URLs carry. */
export const TILES_MIME = 'application/x-pixel-perfect-tiles';

/** Natural px per strip — small enough to decode in a frame or two. */
export const TILE_HEIGHT = 2048;

/** Pictures up to this height stay one file: cutting them buys nothing. */
export const MAX_UNTILED_HEIGHT = TILE_HEIGHT * 1.5;

const MAGIC = [0x50, 0x50, 0x54, 0x4c]; // "PPTL"
const VERSION = 1;
/** magic + version + mime length + width + height + count */
const FIXED_HEADER = 4 + 1 + 1 + 4 * 3;
const PER_TILE = 4 * 2;

export interface Tile {
  /** Natural px */
  height: number;
  /** The strip's own encoded file, typed with the set's `mime` */
  blob: Blob;
}

export interface TileSet {
  /** Natural px of the whole picture */
  width: number;
  height: number;
  /** Encoding of every strip, e.g. image/webp */
  mime: string;
  tiles: Tile[];
}

/** Pack strips, top to bottom, into one container Blob. */
export function packTiles(set: TileSet): Blob {
  const mime = new TextEncoder().encode(set.mime);
  if (mime.length > 255) throw new Error('Tile MIME type too long');

  const header = new Uint8Array(
    FIXED_HEADER + mime.length + PER_TILE * set.tiles.length,
  );
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[4] = VERSION;
  header[5] = mime.length;
  view.setUint32(6, set.width);
  view.setUint32(10, set.height);
  view.setUint32(14, set.tiles.length);
  header.set(mime, FIXED_HEADER);

  let offset = FIXED_HEADER + mime.length;
  for (const tile of set.tiles) {
    view.setUint32(offset, tile.height);
    view.setUint32(offset + 4, tile.blob.size);
    offset += PER_TILE;
  }
  return new Blob([header, ...set.tiles.map((tile) => tile.blob)], {
    type: TILES_MIME,
  });
}

/** Whether `blob` is a container, by its magic bytes — its type can be lost. */
export async function isTileContainer(blob: Blob): Promise<boolean> {
  if (blob.size < FIXED_HEADER) return false;
  const head = new Uint8Array(await blob.slice(0, MAGIC.length).arrayBuffer());
  return MAGIC.every((byte, i) => head[i] === byte);
}

/**
 * The strips inside a container, or null when `blob` is not one.
 *
 * Only the header is read: every strip is a slice of `blob`, so nothing is
 * copied until a strip is actually decoded.
 */
export async function unpackTiles(blob: Blob): Promise<TileSet | null> {
  if (!(await isTileContainer(blob))) return null;

  const fixed = new DataView(await blob.slice(0, FIXED_HEADER).arrayBuffer());
  if (fixed.getUint8(4) !== VERSION) {
    throw new Error('Unsupported tiled image version');
  }
  const mimeLength = fixed.getUint8(5);
  const width = fixed.getUint32(6);
  const height = fixed.getUint32(10);
  const count = fixed.getUint32(14);

  const tableEnd = FIXED_HEADER + mimeLength + PER_TILE * count;
  if (tableEnd > blob.size) throw new Error('Truncated tiled image');
  const rest = new Uint8Array(
    await blob.slice(FIXED_HEADER, tableEnd).arrayBuffer(),
  );
  const mime = new TextDecoder().decode(rest.subarray(0, mimeLength));
  const table = new DataView(rest.buffer, rest.byteOffset + mimeLength);

  const tiles: Tile[] = [];
  let start = tableEnd;
  for (let i = 0; i < count; i++) {
    const tileHeight = table.getUint32(i * PER_TILE);
    const size = table.getUint32(i * PER_TILE + 4);
    if (start + size > blob.size) throw new Error('Truncated tiled image');
    tiles.push({
      height: tileHeight,
      blob: blob.slice(start, start + size, mime),
    });
    start += size;
  }
  return { width, height, mime, tiles };
}
