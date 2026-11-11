import {drawWhole, openRaster} from './raster';

export async function generateDiffImage(
  screenshotSrc: string,
  figmaSrc: string,
  width: number,
  height: number,
  figmaOffsetY = 0,
): Promise<Blob> {
  // Either layer may be a plain file or a strip container: rasters draw both
  const [shot, figma] = await Promise.all([
    openRaster(screenshotSrc),
    openRaster(figmaSrc),
  ]);

  const shotCanvas = document.createElement('canvas');
  shotCanvas.width = width;
  shotCanvas.height = height;
  const shotCtx = shotCanvas.getContext('2d');
  if (!shotCtx) throw new Error('Canvas 2D context unavailable');
  await drawWhole(shotCtx, shot, 0, 0, width, height);

  const figmaCanvas = document.createElement('canvas');
  figmaCanvas.width = width;
  figmaCanvas.height = height;
  const figmaCtx = figmaCanvas.getContext('2d');
  if (!figmaCtx) throw new Error('Canvas 2D context unavailable');
  // Figma scaled to screenshot width; height follows its aspect ratio
  const scaledFigmaHeight = Math.round(
    figma.height * (width / figma.width),
  );
  // Same vertical offset the viewer applies to the Figma layer
  await drawWhole(figmaCtx, figma, 0, figmaOffsetY, width, scaledFigmaHeight);

  const shotData = shotCtx.getImageData(0, 0, width, height);
  const figmaData = figmaCtx.getImageData(0, 0, width, height);
  const out = shotCtx.createImageData(width, height);

  for (let i = 0; i < shotData.data.length; i += 4) {
    const dr = Math.abs(shotData.data[i] - figmaData.data[i]);
    const dg = Math.abs(shotData.data[i + 1] - figmaData.data[i + 1]);
    const db = Math.abs(shotData.data[i + 2] - figmaData.data[i + 2]);
    const delta = Math.max(dr, dg, db);
    // identical -> black; differences -> amplified red-hot highlight
    out.data[i] = Math.min(255, delta * 4);
    out.data[i + 1] = Math.min(255, delta);
    out.data[i + 2] = Math.min(255, delta);
    out.data[i + 3] = 255;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas 2D context unavailable');
  outCtx.putImageData(out, 0, 0);

  return new Promise((resolve, reject) =>
    outCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    ),
  );
}
