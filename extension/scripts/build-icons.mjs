/**
 * Render the extension's toolbar and store icons from the app's own mark, and
 * the store's small promo tile (440×280, required by the Web Store).
 *
 * The source is `app/icon.svg` (the favicon), so the extension and the app
 * wear the same face. Below 24 px the crosshair is drawn heavier, as the
 * BrandMark component does, or it drops under one device pixel.
 *
 * Usage: npm run extension:icons
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, chromiumExecutable } from './chromium.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const out = join(here, '..', 'icons');
const SIZES = [16, 32, 48, 128];

const source = await readFile(join(repo, 'app', 'icon.svg'), 'utf8');

const browser = await chromium.launch({
  executablePath: chromiumExecutable(),
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of SIZES) {
    const svg = (
      size < 24
        ? source.replace('stroke-width="3"', 'stroke-width="5"')
        : source
    ).replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setViewportSize({ width: 400, height: 400 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent;line-height:0">${svg}</body></html>`,
    );
    await page.screenshot({
      path: join(out, `icon-${size}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`icons/icon-${size}.png`);
  }

  // Small promo tile: the mark and the name on the app's ink background
  const mark = source.replace('<svg ', '<svg width="112" height="112" ');
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`<html><body style="margin:0;width:440px;height:280px;
      display:flex;align-items:center;justify-content:center;gap:22px;
      background:#090b11;color:#f4f7fd;font-family:system-ui,sans-serif">
    ${mark}
    <div>
      <div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Pixel Perfect</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:-.02em;color:#a99cff">Capture</div>
      <div style="margin-top:8px;font-size:14px;color:#9aa7bd">Every viewport, your session.</div>
    </div>
  </body></html>`);
  await page.screenshot({
    path: join(here, '..', 'store', 'promo-440x280.png'),
  });
  console.log('store/promo-440x280.png');
} finally {
  await browser.close();
}
