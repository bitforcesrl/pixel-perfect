/**
 * What the app accepts as a dropped (or picked) image, and where a drop lands.
 *
 * One place for these rules, so the canvas, the viewport tabs and the file
 * picker never disagree on what counts as an image or which half is which.
 * Browser-safe and pure apart from reading the DataTransfer it is handed.
 */

/** MIME types every layer accepts: anything the browser decodes to pixels. */
export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
];

/**
 * Extensions for files the OS hands over with no MIME type at all — some
 * apps and some drags from other browsers do — so they are not turned away.
 */
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif|gif|bmp)$/i;

/** The `accept` attribute for a picker that takes what a drop takes. */
export const IMAGE_ACCEPT = [...IMAGE_TYPES, '.png,.jpg,.jpeg,.webp,.avif,.gif,.bmp'].join(',');

/** Whether `file` is an image this app can put on a layer. */
export function isImageFile(file: File): boolean {
  if (file.type) return IMAGE_TYPES.includes(file.type);
  return IMAGE_EXTENSIONS.test(file.name);
}

/** The images in a drop, in the order they were dropped. */
export function imageFiles(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter(isImageFile);
}

/** Whether a drag is carrying files at all — hover state should not lie. */
export function hasFiles(transfer: DataTransfer | null): boolean {
  return Array.from(transfer?.types ?? []).includes('Files');
}

/** Which layer a drop is aimed at. */
export type DropSide = 'figma' | 'site';

/**
 * Left half takes the Figma export, right half the site screenshot — the
 * same sides the split view puts them on. Worked out from the pointer itself,
 * so a drop never depends on a hover state that may not have rendered yet.
 */
export function dropSide(target: Element, clientX: number): DropSide {
  const rect = target.getBoundingClientRect();
  return clientX < rect.left + rect.width / 2 ? 'figma' : 'site';
}
