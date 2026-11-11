import { describe, it, expect } from 'vitest';
import { browserlessEndpoint, acquireBrowser } from './browser';

describe('browserlessEndpoint', () => {
  it('returns null with no token, so local runs launch a local browser', () => {
    expect(browserlessEndpoint({})).toBeNull();
    expect(browserlessEndpoint({ BROWSERLESS_TOKEN: '   ' })).toBeNull();
  });

  it('builds the default endpoint from a token alone', () => {
    const url = new URL(browserlessEndpoint({ BROWSERLESS_TOKEN: 'abc123' })!);
    expect(url.protocol).toBe('wss:');
    expect(url.host).toBe('production-sfo.browserless.io');
    // The CDP endpoint, not /chromium/playwright: the Playwright protocol only
    // works when the remote version matches this project's.
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('token')).toBe('abc123');
  });

  it('asks for no more session time than the smallest plan allows', () => {
    // Browserless rejects the connection outright with a 400 when the
    // requested timeout is over the plan's cap; the free tier's is 60s.
    const url = new URL(browserlessEndpoint({ BROWSERLESS_TOKEN: 'abc123' })!);
    expect(Number(url.searchParams.get('timeout'))).toBeLessThanOrEqual(60_000);
  });

  it('honours BROWSERLESS_TIMEOUT_MS and ignores junk values', () => {
    const withTimeout = (BROWSERLESS_TIMEOUT_MS?: string) =>
      new URL(
        browserlessEndpoint({
          BROWSERLESS_TOKEN: 'abc123',
          BROWSERLESS_TIMEOUT_MS,
        })!,
      ).searchParams.get('timeout');

    expect(withTimeout('90000')).toBe('90000');
    expect(withTimeout('nonsense')).toBe(withTimeout(undefined));
    expect(withTimeout('-5')).toBe(withTimeout(undefined));
  });

  it('lets BROWSERLESS_URL pick another region and keeps its own timeout', () => {
    const url = new URL(
      browserlessEndpoint({
        BROWSERLESS_TOKEN: 'abc123',
        BROWSERLESS_URL: 'wss://production-lon.browserless.io?timeout=120000',
      })!,
    );
    expect(url.host).toBe('production-lon.browserless.io');
    expect(url.searchParams.get('timeout')).toBe('120000');
    expect(url.searchParams.get('token')).toBe('abc123');
  });

  it('passes a proxy request through, country and all', () => {
    const url = new URL(
      browserlessEndpoint({
        BROWSERLESS_TOKEN: 'abc123',
        BROWSERLESS_PROXY: 'residential',
        BROWSERLESS_PROXY_COUNTRY: 'it',
      })!,
    );
    expect(url.searchParams.get('proxy')).toBe('residential');
    expect(url.searchParams.get('proxyCountry')).toBe('it');
  });

  it('asks for no proxy unless one is configured', () => {
    const url = new URL(browserlessEndpoint({ BROWSERLESS_TOKEN: 'abc123' })!);
    expect(url.searchParams.has('proxy')).toBe(false);
    expect(url.searchParams.has('proxyCountry')).toBe(false);
  });

  it('upgrades an http(s) base to a websocket scheme', () => {
    const url = new URL(
      browserlessEndpoint({
        BROWSERLESS_TOKEN: 'abc123',
        BROWSERLESS_URL: 'https://production-ams.browserless.io',
      })!,
    );
    expect(url.protocol).toBe('wss:');
  });
});

describe('acquireBrowser', () => {
  it('refuses to launch locally on Vercel and names the missing variable', async () => {
    await expect(acquireBrowser({ VERCEL: '1' })).rejects.toThrow(
      /BROWSERLESS_TOKEN/,
    );
  });

  it('reports a failed connection without leaking the token', async () => {
    // Port 1 refuses immediately, so this fails at connect time.
    const promise = acquireBrowser({
      BROWSERLESS_TOKEN: 'super-secret-token',
      BROWSERLESS_URL: 'ws://127.0.0.1:1',
      BROWSERLESS_TIMEOUT_MS: '1000',
    });
    await expect(promise).rejects.toThrow(/Failed to connect to Browserless/);
    await expect(promise).rejects.not.toThrow(/super-secret-token/);
  }, 30_000);

  it('frees the concurrency slot when a connection fails', async () => {
    // With a limit of one, a leaked slot would hang every capture after the
    // first failure instead of letting it try.
    const env = {
      BROWSERLESS_TOKEN: 'abc123',
      BROWSERLESS_URL: 'ws://127.0.0.1:1',
      BROWSERLESS_CONCURRENCY: '1',
    };
    await expect(acquireBrowser(env)).rejects.toThrow();
    await expect(acquireBrowser(env)).rejects.toThrow();
  }, 30_000);
});
