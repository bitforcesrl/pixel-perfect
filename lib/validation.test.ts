import {describe, it, expect} from 'vitest';
import {validateScreenshotRequest} from './validation';

describe('validateScreenshotRequest', () => {
  it('accepts a valid request', () => {
    const result = validateScreenshotRequest({
      url: 'https://example.com',
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        url: 'https://example.com',
        viewportWidth: 1440,
        viewportHeight: 900,
      },
    });
  });

  it('rejects a non-http(s) URL', () => {
    const result = validateScreenshotRequest({
      url: 'ftp://example.com',
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed URL', () => {
    const result = validateScreenshotRequest({
      url: 'not a url',
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects viewport dimensions outside 200-4000', () => {
    for (const [w, h] of [
      [100, 900],
      [5000, 900],
      [1440, 100],
      [1440, 5000],
    ]) {
      const result = validateScreenshotRequest({
        url: 'https://example.com',
        viewportWidth: w,
        viewportHeight: h,
      });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects non-integer viewport dimensions', () => {
    const result = validateScreenshotRequest({
      url: 'https://example.com',
      viewportWidth: 1440.5,
      viewportHeight: 900,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects missing or wrongly-typed fields', () => {
    expect(validateScreenshotRequest(null).ok).toBe(false);
    expect(validateScreenshotRequest({}).ok).toBe(false);
    expect(
      validateScreenshotRequest({
        url: 42,
        viewportWidth: 1440,
        viewportHeight: 900,
      }).ok,
    ).toBe(false);
    expect(
      validateScreenshotRequest({
        url: 'https://example.com',
        viewportWidth: '1440',
        viewportHeight: 900,
      }).ok,
    ).toBe(false);
  });
});
