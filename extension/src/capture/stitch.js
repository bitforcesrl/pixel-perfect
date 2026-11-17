/**
 * Put the slices of a tall capture back together as one PNG.
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

/**
 * @param slices `{ base64, y, height }` in CSS px, top to bottom
 * @param size the whole page: CSS `width`/`height` and the device `scale`
 * @returns a PNG data URL
 */
export async function stitchSlices(slices, { width, height, scale }) {
  if (slices.length === 1) return `data:image/png;base64,${slices[0].base64}`;
  const canvas = new OffscreenCanvas(
    Math.round(width * scale),
    Math.round(height * scale),
  );
  const context = canvas.getContext('2d');
  for (const slice of slices) {
    const bitmap = await createImageBitmap(base64ToBlob(slice.base64));
    context.drawImage(bitmap, 0, Math.round(slice.y * scale));
    bitmap.close();
  }
  const png = await canvas.convertToBlob({ type: 'image/png' });
  return `data:image/png;base64,${await blobToBase64(png)}`;
}
