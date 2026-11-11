/**
 * A PNG written strip by strip.
 *
 * A canvas tall enough to hold a full-page 2x render is past what browsers
 * allow — Chrome stops at 32767 px a side, Safari at 16.7 MP in all — so a
 * picture that size cannot come out of `toBlob`. This encodes it from rows
 * instead: each strip is filtered and fed to the browser's own deflate as it
 * arrives, and only the compressed bytes are kept. Browser only.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(parts: Uint8Array[]): number {
  let crc = 0xffffffff;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      crc = CRC_TABLE[(crc ^ part[i]) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

/** Length, type, data, CRC — the CRC covers the type and the data. */
function chunk(type: string, data: Uint8Array<ArrayBuffer>): BlobPart[] {
  const name = new TextEncoder().encode(type);
  return [u32(data.length), name, data, u32(crc32([name, data]))];
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export interface PngWriter {
  /** Whole RGBA rows, top to bottom — any number of them per call. */
  write(rgba: Uint8ClampedArray): Promise<void>;
  /** The finished file, once every row of the image has been written. */
  finish(): Promise<Blob>;
}

export function createPngWriter(width: number, height: number): PngWriter {
  const stride = width * 4;
  const deflate = new CompressionStream('deflate');
  const writer = deflate.writable.getWriter();
  // Drained while rows are still going in, or the stream stalls on its own
  // backpressure
  const compressed = new Response(deflate.readable).arrayBuffer();
  let written = 0;

  return {
    async write(rgba) {
      const rows = rgba.length / stride;
      // Each row behind a filter byte: Sub, which stores each byte as its
      // difference from the pixel to its left — flat UI compresses to little
      const out = new Uint8Array(rows * (stride + 1));
      for (let row = 0; row < rows; row++) {
        const src = row * stride;
        const dst = row * (stride + 1);
        out[dst] = 1;
        for (let i = 0; i < stride; i++) {
          out[dst + 1 + i] = rgba[src + i] - (i >= 4 ? rgba[src + i - 4] : 0);
        }
      }
      written += rows;
      await writer.ready;
      await writer.write(out);
    },

    async finish() {
      if (written !== height) {
        throw new Error(`PNG has ${written} of ${height} rows`);
      }
      await writer.close();
      const data = new Uint8Array(await compressed);

      const header = new Uint8Array(13);
      const view = new DataView(header.buffer);
      view.setUint32(0, width);
      view.setUint32(4, height);
      header[8] = 8; // bits per channel
      header[9] = 6; // RGBA
      // compression, filter and interlace methods: all 0

      return new Blob(
        [
          SIGNATURE,
          ...chunk('IHDR', header),
          ...chunk('IDAT', data),
          ...chunk('IEND', new Uint8Array(0)),
        ],
        { type: 'image/png' },
      );
    },
  };
}
