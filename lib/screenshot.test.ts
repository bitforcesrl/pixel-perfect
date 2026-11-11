import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { takeScreenshot, closeBrowser } from './screenshot';
import { renderScaleFor } from './render-scale';

const VIEWPORT = { width: 800, height: 600 };
const BLOCK_COUNT = 10;
const BLOCK_HEIGHT = 1000;
const CONTENT_HEIGHT = BLOCK_COUNT * BLOCK_HEIGHT;

const blocks = Array.from(
  { length: BLOCK_COUNT },
  (_, i) =>
    `<div class="block" style="background:hsl(${i * 20} 70% 60%)">BLOCK ${i}</div>`,
).join('');

const BASE_CSS = `body{margin:0}.block{height:${BLOCK_HEIGHT}px;font:48px sans-serif;display:flex;align-items:center;justify-content:center}`;

/**
 * Page shapes that all render the same {@link CONTENT_HEIGHT} of content but
 * expose it to the document in different ways.
 */
const PAGES: Record<string, string> = {
  // Ordinary document scroll.
  plain: `<style>${BASE_CSS}</style>${blocks}`,

  // Body locked, an inner element is the scroll container.
  'overflow-container': `<style>${BASE_CSS}html,body{height:100%;overflow:hidden}#s{height:100%;overflow-y:auto}</style><div id="s">${blocks}</div>`,

  // Smooth-scroll libraries (Locomotive, Lenis, ScrollSmoother): a fixed
  // full-viewport wrapper holding transformed content. The document itself
  // never grows, so its scrollHeight stays at the viewport height.
  'fixed-transform': `<style>${BASE_CSS}html,body{height:100%;overflow:hidden}#wrap{position:fixed;inset:0;overflow:hidden}#inner{will-change:transform;transform:translate3d(0,0,0)}</style><div id="wrap"><div id="inner">${blocks}</div></div>`,

  // Sections that only render once scrolled into view, each revealing the next
  // — the shape used by Shopify themes and most reveal-on-scroll setups. The
  // page starts one screen tall and only reaches full height if the scroll
  // pass keeps following the growing document all the way to the footer.
  'lazy-growth': `<style>${BASE_CSS}.pending{height:200px}footer{height:${BLOCK_HEIGHT}px;background:#0b1f6b;color:#fff;font:48px sans-serif;display:flex;align-items:center;justify-content:center}</style>
    <div id="stage-0">${Array.from({ length: 2 }, (_, i) => `<div class="block" style="background:hsl(${i * 20} 70% 60%)">BLOCK ${i}</div>`).join('')}</div>
    <div class="pending" id="sentinel-0"></div>
    <script>
      var STAGES = ${BLOCK_COUNT / 2};
      function mount(stage) {
        var sentinel = document.getElementById('sentinel-' + stage);
        if (!sentinel || sentinel.dataset.done) return;
        sentinel.dataset.done = '1';
        var next = stage + 1;
        var html = '';
        for (var i = 0; i < 2; i++) {
          var n = next * 2 + i;
          html += '<div class="block" style="background:hsl(' + n * 20 + ' 70% 60%)">BLOCK ' + n + '</div>';
        }
        sentinel.insertAdjacentHTML('afterend', '<div id="stage-' + next + '">' + html + '</div>');
        sentinel.remove();
        if (next < STAGES - 1) {
          document.getElementById('stage-' + next)
            .insertAdjacentHTML('afterend', '<div class="pending" id="sentinel-' + next + '"></div>');
          observe(next);
        } else {
          document.getElementById('stage-' + next)
            .insertAdjacentHTML('afterend', '<footer>FOOTER CONTENT</footer>');
        }
      }
      function observe(stage) {
        var el = document.getElementById('sentinel-' + stage);
        new IntersectionObserver(function (entries, obs) {
          if (entries.some(function (e) { return e.isIntersecting; })) {
            obs.disconnect();
            setTimeout(function () { mount(stage); }, 120);
          }
        }).observe(el);
      }
      observe(0);
    </script>`,
};

let server: http.Server;
let origin: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const shape = (req.url ?? '').slice(1);
    // Stands in for a host that turns the capture away — Shopify answers a
    // throttled request with exactly this.
    if (shape === 'rate-limited') {
      res.writeHead(429, { 'content-type': 'text/plain' });
      res.end('local_rate_limited');
      return;
    }
    const body = PAGES[shape] ?? '';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head></head><body>${body}</body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await closeBrowser();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Reads width/height out of a PNG's IHDR chunk. */
function pngSize(dataUrl: string) {
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Full rendered height each shape must reach — the lazy one adds a footer. */
const EXPECTED_HEIGHT: Record<string, number> = {
  plain: CONTENT_HEIGHT,
  'overflow-container': CONTENT_HEIGHT,
  'fixed-transform': CONTENT_HEIGHT,
  'lazy-growth': CONTENT_HEIGHT + BLOCK_HEIGHT,
};

describe('takeScreenshot', () => {
  for (const shape of Object.keys(PAGES)) {
    it(`captures the whole page for a "${shape}" layout`, async () => {
      const result = await takeScreenshot({
        url: `${origin}/${shape}`,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      });

      const png = pngSize(result.image);
      expect(result.width).toBe(VIEWPORT.width);
      // The capture must cover the full content, not just the first screen.
      expect(result.height).toBeGreaterThanOrEqual(EXPECTED_HEIGHT[shape]);
      // Reported size is in CSS px; the image carries 2 device px for each.
      expect(png.width).toBe(result.width * renderScaleFor(VIEWPORT.width));
      expect(png.height).toBe(result.height * renderScaleFor(VIEWPORT.width));
    }, 120_000);
  }

  it('captures at the requested viewport width, not the browser default', async () => {
    const width = 390;
    const result = await takeScreenshot({
      url: `${origin}/plain`,
      viewportWidth: width,
      viewportHeight: 844,
    });
    expect(result.width).toBe(width);
    expect(pngSize(result.image).width).toBe(width * 2);
  }, 120_000);

  it('refuses a page the host turned away instead of picturing the error', async () => {
    await expect(
      takeScreenshot({
        url: `${origin}/rate-limited`,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
      }),
    ).rejects.toThrow(/answered 429/);
  }, 120_000);
});
