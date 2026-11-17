import { describe, expect, it } from 'vitest';
import { parseCaptureRequest } from '../src/lib/protocol.js';

const valid = () => ({
  type: 'capture',
  requestId: 'r1',
  url: 'https://shop.example.com/products/a',
  viewports: [
    { key: 'mobile', width: 375, height: 812, scale: 2 },
    { key: 'desktop', width: 1440, height: 900, scale: 1 },
  ],
  encoding: { quality: 0.5, stripHeight: 2048 },
});

describe('parseCaptureRequest', () => {
  it('accepts a well-formed request', () => {
    const parsed = parseCaptureRequest(valid());
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toEqual({
      requestId: 'r1',
      url: 'https://shop.example.com/products/a',
      viewports: valid().viewports,
      encoding: valid().encoding,
    });
  });

  it.each([
    'chrome://settings',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
    'file:///etc/hosts',
    'chrome-extension://abc/page.html',
    'not a url',
  ])('refuses %s', (url) => {
    expect(parseCaptureRequest({ ...valid(), url }).ok).toBe(false);
  });

  it('refuses a width outside 200–4000', () => {
    const request = valid();
    request.viewports[0].width = 100;
    expect(parseCaptureRequest(request).ok).toBe(false);
  });

  it('refuses more than 12 viewports', () => {
    const request = valid();
    request.viewports = Array.from({ length: 13 }, (_, i) => ({
      key: `v${i}`,
      width: 400,
      height: 800,
    }));
    expect(parseCaptureRequest(request).ok).toBe(false);
  });

  it('refuses a request without an id', () => {
    const request = valid();
    delete request.requestId;
    expect(parseCaptureRequest(request).ok).toBe(false);
  });

  it('refuses an empty viewport key', () => {
    const request = valid();
    request.viewports[0].key = '';
    expect(parseCaptureRequest(request).ok).toBe(false);
  });
});
