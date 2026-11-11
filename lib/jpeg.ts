/**
 * A baseline JPEG written strip by strip.
 *
 * The same problem `png.ts` solves, for the lossy fallback: a full-page 2x
 * capture is past the canvas size browsers allow, so `toBlob` cannot encode
 * it. This takes RGBA rows as they are drawn, band by band, and turns every
 * eight of them into a row of 8x8 blocks — only the compressed bytes are kept.
 *
 * Plain baseline: standard Huffman tables, no chroma subsampling (4:4:4), so
 * coloured text keeps its edges. The DCT is the AAN float version the IJG and
 * most JS encoders use. Browser or Node — nothing here touches the DOM.
 */

/** Natural position → zigzag position. */
const ZIGZAG = [
  0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30,
  41, 43, 9, 11, 18, 24, 31, 40, 44, 53, 10, 19, 23, 32, 39, 45, 52, 54, 20, 22,
  33, 38, 46, 51, 55, 60, 21, 34, 37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57,
  58, 62, 63,
];

const LUMA_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16,
  24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109,
  103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

const CHROMA_QUANT = [
  17,
  18,
  24,
  47,
  99,
  99,
  99,
  99,
  18,
  21,
  26,
  66,
  99,
  99,
  99,
  99,
  24,
  26,
  56,
  99,
  99,
  99,
  99,
  99,
  47,
  66,
  99,
  99,
  99,
  99,
  99,
  99,
  ...new Array(32).fill(99),
];

/** AAN scale factors, folded into the quantisation step. */
const AAN = [
  1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961,
  0.275899379,
];

// Standard Huffman tables (JPEG spec, Annex K.3): codes per length, values
const DC_LUMA_COUNTS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_CHROMA_COUNTS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const AC_LUMA_COUNTS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VALUES = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13,
  0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42,
  0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a,
  0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
  0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a,
  0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67,
  0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84,
  0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
  0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3,
  0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7,
  0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

const AC_CHROMA_COUNTS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VALUES = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51,
  0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1,
  0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24,
  0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a,
  0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66,
  0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82,
  0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96,
  0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa,
  0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9,
  0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

/** Largest side a JPEG header can state. */
export const MAX_JPEG_SIDE = 65535;

/** Symbol → [code, bit length]. */
type HuffmanTable = Array<[number, number]>;

function huffman(counts: number[], values: number[]): HuffmanTable {
  const table: HuffmanTable = [];
  let code = 0;
  let pos = 0;
  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < counts[length - 1]; i++) {
      table[values[pos++]] = [code++, length];
    }
    code *= 2;
  }
  return table;
}

const DC_LUMA = huffman(DC_LUMA_COUNTS, DC_VALUES);
const AC_LUMA = huffman(AC_LUMA_COUNTS, AC_LUMA_VALUES);
const DC_CHROMA = huffman(DC_CHROMA_COUNTS, DC_VALUES);
const AC_CHROMA = huffman(AC_CHROMA_COUNTS, AC_CHROMA_VALUES);

interface Quant {
  /** As the DQT segment stores it: zigzag order. */
  table: Uint8Array;
  /** Per natural position: the reciprocal step, AAN scaling folded in. */
  divisors: Float32Array;
}

/** IJG quality scaling: 50 is the spec's table, 100 almost lossless. */
function quantFor(base: number[], quality: number): Quant {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = q < 50 ? 5000 / q : 200 - q * 2;
  const table = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const step = Math.floor((base[i] * scale + 50) / 100);
    table[ZIGZAG[i]] = Math.min(255, Math.max(1, step));
  }
  const divisors = new Float32Array(64);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const k = row * 8 + col;
      divisors[k] = 1 / (table[ZIGZAG[k]] * AAN[row] * AAN[col] * 8);
    }
  }
  return { table, divisors };
}

/** Forward DCT in place (AAN), then quantised into `out` in zigzag order. */
function dctQuant(data: Float32Array, divisors: Float32Array, out: Int32Array) {
  for (let pass = 0; pass < 2; pass++) {
    // Rows first, then columns: same butterflies, different stride
    const step = pass === 0 ? 1 : 8;
    const next = pass === 0 ? 8 : 1;
    for (let i = 0, base = 0; i < 8; i++, base += next) {
      const p0 = base;
      const p1 = base + step;
      const p2 = base + step * 2;
      const p3 = base + step * 3;
      const p4 = base + step * 4;
      const p5 = base + step * 5;
      const p6 = base + step * 6;
      const p7 = base + step * 7;

      const tmp0 = data[p0] + data[p7];
      const tmp7 = data[p0] - data[p7];
      const tmp1 = data[p1] + data[p6];
      const tmp6 = data[p1] - data[p6];
      const tmp2 = data[p2] + data[p5];
      const tmp5 = data[p2] - data[p5];
      const tmp3 = data[p3] + data[p4];
      const tmp4 = data[p3] - data[p4];

      // Even part
      let tmp10 = tmp0 + tmp3;
      const tmp13 = tmp0 - tmp3;
      let tmp11 = tmp1 + tmp2;
      let tmp12 = tmp1 - tmp2;
      data[p0] = tmp10 + tmp11;
      data[p4] = tmp10 - tmp11;
      const z1 = (tmp12 + tmp13) * 0.707106781;
      data[p2] = tmp13 + z1;
      data[p6] = tmp13 - z1;

      // Odd part
      tmp10 = tmp4 + tmp5;
      tmp11 = tmp5 + tmp6;
      tmp12 = tmp6 + tmp7;
      const z5 = (tmp10 - tmp12) * 0.382683433;
      const z2 = 0.5411961 * tmp10 + z5;
      const z4 = 1.306562965 * tmp12 + z5;
      const z3 = tmp11 * 0.707106781;
      const z11 = tmp7 + z3;
      const z13 = tmp7 - z3;
      data[p5] = z13 + z2;
      data[p3] = z13 - z2;
      data[p1] = z11 + z4;
      data[p7] = z11 - z4;
    }
  }
  for (let i = 0; i < 64; i++) {
    const v = data[i] * divisors[i];
    out[ZIGZAG[i]] = v > 0 ? (v + 0.5) | 0 : (v - 0.5) | 0;
  }
}

/** Bytes gathered in fixed chunks, so a long scan never reallocates. */
class ByteSink {
  readonly parts: Uint8Array<ArrayBuffer>[] = [];
  private chunk = new Uint8Array(1 << 16);
  private pos = 0;

  byte(value: number) {
    if (this.pos === this.chunk.length) this.flush();
    this.chunk[this.pos++] = value;
  }

  bytes(values: ArrayLike<number>) {
    for (let i = 0; i < values.length; i++) this.byte(values[i]);
  }

  u16(value: number) {
    this.byte((value >> 8) & 0xff);
    this.byte(value & 0xff);
  }

  flush() {
    if (this.pos === 0) return;
    this.parts.push(this.chunk.slice(0, this.pos));
    this.pos = 0;
  }
}

export interface JpegWriter {
  /**
   * Whole RGBA rows, top to bottom. Every call but the last must carry a
   * multiple of 8 rows — a JPEG is coded in 8-row strips. Alpha is ignored:
   * flatten transparent pictures before handing them over.
   */
  write(rgba: Uint8ClampedArray): Promise<void>;
  /** The finished file, once every row of the image has been written. */
  finish(): Promise<Blob>;
}

/** `quality` on the usual 1–100 scale. */
export function createJpegWriter(
  width: number,
  height: number,
  quality: number,
): JpegWriter {
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_JPEG_SIDE ||
    height > MAX_JPEG_SIDE
  ) {
    throw new Error(`A JPEG cannot be ${width}x${height}`);
  }
  const luma = quantFor(LUMA_QUANT, quality);
  const chroma = quantFor(CHROMA_QUANT, quality);
  const out = new ByteSink();

  // Headers: SOI, JFIF, quantisation, frame, Huffman tables, scan
  out.bytes([0xff, 0xd8]);
  out.bytes([
    0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
  ]);
  out.bytes([0xff, 0xdb]);
  out.u16(2 + 65 * 2);
  out.byte(0);
  out.bytes(luma.table);
  out.byte(1);
  out.bytes(chroma.table);
  out.bytes([0xff, 0xc0]);
  out.u16(17);
  out.byte(8);
  out.u16(height);
  out.u16(width);
  out.bytes([3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
  out.bytes([0xff, 0xc4]);
  out.u16(
    2 +
      4 * 17 +
      2 * DC_VALUES.length +
      AC_LUMA_VALUES.length +
      AC_CHROMA_VALUES.length,
  );
  for (const [id, counts, values] of [
    [0x00, DC_LUMA_COUNTS, DC_VALUES],
    [0x10, AC_LUMA_COUNTS, AC_LUMA_VALUES],
    [0x01, DC_CHROMA_COUNTS, DC_VALUES],
    [0x11, AC_CHROMA_COUNTS, AC_CHROMA_VALUES],
  ] as const) {
    out.byte(id);
    out.bytes(counts);
    out.bytes(values);
  }
  out.bytes([0xff, 0xda]);
  out.u16(12);
  out.bytes([3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);

  // Entropy-coded bits, MSB first, with a 0x00 stuffed after every 0xFF
  let acc = 0;
  let accBits = 0;
  const bits = (code: number, length: number) => {
    acc = (acc << length) | code;
    accBits += length;
    while (accBits >= 8) {
      const b = (acc >>> (accBits - 8)) & 0xff;
      out.byte(b);
      if (b === 0xff) out.byte(0);
      accBits -= 8;
    }
    acc &= (1 << accBits) - 1;
  };

  /** A coefficient's magnitude category and its bits. */
  const value = (v: number) => {
    let magnitude = v < 0 ? -v : v;
    let size = 0;
    while (magnitude) {
      size++;
      magnitude >>= 1;
    }
    return [size, v < 0 ? v + (1 << size) - 1 : v] as const;
  };

  const coefficients = new Int32Array(64);
  const block = (
    data: Float32Array,
    quant: Quant,
    dc: HuffmanTable,
    ac: HuffmanTable,
    previous: number,
  ): number => {
    dctQuant(data, quant.divisors, coefficients);

    const diff = coefficients[0] - previous;
    const [dcSize, dcBits] = value(diff);
    bits(dc[dcSize][0], dc[dcSize][1]);
    if (dcSize) bits(dcBits, dcSize);

    let last = 63;
    while (last > 0 && coefficients[last] === 0) last--;
    let run = 0;
    for (let i = 1; i <= last; i++) {
      const c = coefficients[i];
      if (c === 0) {
        run++;
        continue;
      }
      while (run >= 16) {
        bits(ac[0xf0][0], ac[0xf0][1]);
        run -= 16;
      }
      const [size, cBits] = value(c);
      const symbol = ac[(run << 4) | size];
      bits(symbol[0], symbol[1]);
      bits(cBits, size);
      run = 0;
    }
    if (last < 63) bits(ac[0][0], ac[0][1]);
    return coefficients[0];
  };

  const y = new Float32Array(64);
  const cb = new Float32Array(64);
  const cr = new Float32Array(64);
  let dcY = 0;
  let dcCb = 0;
  let dcCr = 0;
  let written = 0;
  const stride = width * 4;

  return {
    async write(rgba) {
      const rows = rgba.length / stride;
      if (!Number.isInteger(rows) || rows === 0) {
        throw new Error('JPEG rows must be whole RGBA rows');
      }
      if (rows % 8 !== 0 && written + rows !== height) {
        throw new Error('Only the last JPEG band may stop short of 8 rows');
      }
      if (written + rows > height) {
        throw new Error(
          `JPEG has room for ${height} rows, got ${written + rows}`,
        );
      }

      for (let top = 0; top < rows; top += 8) {
        for (let left = 0; left < width; left += 8) {
          for (let r = 0; r < 8; r++) {
            // Past the last row or column, the edge pixel repeats
            const row = Math.min(top + r, rows - 1) * stride;
            for (let c = 0; c < 8; c++) {
              const p = row + Math.min(left + c, width - 1) * 4;
              const red = rgba[p];
              const green = rgba[p + 1];
              const blue = rgba[p + 2];
              const k = r * 8 + c;
              y[k] = 0.299 * red + 0.587 * green + 0.114 * blue - 128;
              cb[k] = -0.16874 * red - 0.33126 * green + 0.5 * blue;
              cr[k] = 0.5 * red - 0.41869 * green - 0.08131 * blue;
            }
          }
          dcY = block(y, luma, DC_LUMA, AC_LUMA, dcY);
          dcCb = block(cb, chroma, DC_CHROMA, AC_CHROMA, dcCb);
          dcCr = block(cr, chroma, DC_CHROMA, AC_CHROMA, dcCr);
        }
      }
      written += rows;
    },

    async finish() {
      if (written !== height) {
        throw new Error(`JPEG has ${written} of ${height} rows`);
      }
      // Pad the last byte with 1 bits, as the spec asks
      if (accBits > 0) bits((1 << (8 - accBits)) - 1, 8 - accBits);
      out.bytes([0xff, 0xd9]);
      out.flush();
      return new Blob(out.parts, { type: 'image/jpeg' });
    },
  };
}
