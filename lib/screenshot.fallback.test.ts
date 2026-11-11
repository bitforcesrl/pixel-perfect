import {describe, it, expect, beforeAll, afterAll, beforeEach, vi} from 'vitest';
import http from 'node:http';
import os from 'node:os';
import type {AddressInfo} from 'node:net';

/**
 * Stands in for a Browserless session: a real local browser handed to the
 * capture as if it were the remote one. Everything the fallback keys off is in
 * the lease, so this is enough to drive it.
 */
vi.mock('./browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./browser')>();
  return {
    ...actual,
    acquireBrowser: vi.fn(async () => ({
      ...(await actual.acquireLocalBrowser()),
      remote: true,
    })),
  };
});

const {takeScreenshot, closeBrowser} = await import('./screenshot');

const VIEWPORT = {width: 800, height: 600};
const PAGE = '<!doctype html><html><body style="margin:0"><h1>SERVED</h1></body></html>';

/**
 * A remote browser has no route to a loopback address, and the capture says so
 * before it navigates — which would stop these tests before they reach the
 * status they are about. Serve on this machine's LAN address instead, which a
 * remote browser could plausibly reach.
 */
function lanAddress(): string | null {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

let server: http.Server;
let origin: string;
let hits: Record<string, number>;
const host = lanAddress();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    hits[path] = (hits[path] ?? 0) + 1;

    // Shopify answers a request from a shared datacenter address with exactly
    // this. `blocked-once` turns the first caller away and serves the second,
    // which is the shape of the real failure: the remote address is blocked,
    // this machine's own is not.
    const blocked =
      path === '/blocked-always' || (path === '/blocked-once' && hits[path] === 1);
    if (blocked) {
      res.writeHead(429, {'content-type': 'text/plain'});
      res.end('local_rate_limited');
      return;
    }
    if (path === '/server-error') {
      res.writeHead(500, {'content-type': 'text/plain'});
      res.end('boom');
      return;
    }
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  origin = `http://${host}:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await closeBrowser();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  hits = {};
  delete process.env.VERCEL;
});

const capture = (path: string) =>
  takeScreenshot({
    url: `${origin}${path}`,
    viewportWidth: VIEWPORT.width,
    viewportHeight: VIEWPORT.height,
  });

// Without a routable address there is no way to stand a target up where a
// remote browser could reach it, so there is nothing to test here.
describe.skipIf(!host)('takeScreenshot with a remote browser the target turned away', () => {
  it('retries on this machine own connection and returns the capture', async () => {
    const result = await capture('/blocked-once');
    expect(result.image.startsWith('data:image/png;base64,')).toBe(true);
    // Once turned away, once served: the retry actually happened.
    expect(hits['/blocked-once']).toBe(2);
  }, 120_000);

  it('gives up when the target turns the retry away too', async () => {
    await expect(capture('/blocked-always')).rejects.toThrow(/answered 429/);
    expect(hits['/blocked-always']).toBe(2);
  }, 120_000);

  it('does not retry a failure that is not about the address', async () => {
    await expect(capture('/server-error')).rejects.toThrow(/answered 500/);
    expect(hits['/server-error']).toBe(1);
  }, 120_000);

  it('names the proxy when there is no local browser to fall back to', async () => {
    // Serverless: nothing to retry with, so the caller gets the way out.
    process.env.VERCEL = '1';
    await expect(capture('/blocked-once')).rejects.toThrow(
      /BROWSERLESS_PROXY=residential/,
    );
    expect(hits['/blocked-once']).toBe(1);
  }, 120_000);
});
