/**
 * Turn the slices of a capture into the WebP strips the app stores.
 *
 * Runs in the service worker: `OffscreenCanvas` and `createImageBitmap` are
 * available there, `FileReader` and `Image` are not, hence the manual base64.
 */

function base64ToBlob(base64, type = 'image/png') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Spread in chunks: one call per byte is slow, one call for all of them
  // overflows the argument limit on a large image
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

const WEBP = 'image/webp';

/**
 * Cut the slices of a capture into strips, each its own WebP, without ever
 * stitching the page: only one slice is held as pixels at a time. The strips
 * are exactly what the app stores (`lib/tile-container.ts`), so it packs them
 * as they are, with no decoding and no second lossy pass.
 *
 * @param slices `{ base64 }` PNGs, top to bottom, each a whole number of
 *   strips but the last
 * @param options `stripRows`: natural px per full strip; `quality` of the WebP
 * @returns `{ strips: { height, data }[], pixelWidth, pixelHeight }`, natural
 *   px, `data` base64 WebP
 */
export async function encodeStrips(slices, { stripRows, quality, signal }) {
  const strips = [];
  let pixelWidth = 0;
  let pixelHeight = 0;
  for (const slice of slices) {
    signal?.throwIfAborted();
    const bitmap = await createImageBitmap(base64ToBlob(slice.base64));
    try {
      pixelWidth = Math.max(pixelWidth, bitmap.width);
      const canvas = new OffscreenCanvas(bitmap.width, stripRows);
      const context = canvas.getContext('2d');
      for (let top = 0; top < bitmap.height; top += stripRows) {
        const rows = Math.min(stripRows, bitmap.height - top);
        // Resizing also clears; full strips reuse the canvas as it is
        if (canvas.height !== rows) canvas.height = rows;
        else context.clearRect(0, 0, canvas.width, rows);
        context.drawImage(
          bitmap,
          0,
          top,
          bitmap.width,
          rows,
          0,
          0,
          bitmap.width,
          rows,
        );
        const blob = await canvas.convertToBlob({ type: WEBP, quality });
        // Chrome always encodes WebP; anything else would be mislabelled
        if (blob.type !== WEBP) {
          throw new Error('This browser could not encode the capture as WebP');
        }
        strips.push({ height: rows, data: await blobToBase64(blob) });
        pixelHeight += rows;
      }
    } finally {
      bitmap.close();
    }
  }
  return { strips, pixelWidth, pixelHeight };
}
