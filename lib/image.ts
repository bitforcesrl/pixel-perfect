import {unpackTiles} from './tile-container';

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Natural pixel size of an image file — or of a strip container, whose size
 * is in its header and needs no decode at all. Browser only.
 */
export async function readImageSize(objectUrl: string): Promise<ImageSize> {
  const tiled = await unpackTiles(await (await fetch(objectUrl)).blob()).catch(
    () => null,
  );
  if (tiled) return {width: tiled.width, height: tiled.height};
  return decodeImageSize(objectUrl);
}

function decodeImageSize(objectUrl: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({width: img.naturalWidth, height: img.naturalHeight});
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = objectUrl;
  });
}

/** The file's own bytes as a data URL, untouched. Browser only. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}
