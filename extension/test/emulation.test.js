import { describe, expect, it } from 'vitest';
import { emulationFor, MOBILE_UA } from '../src/lib/emulation.js';

describe('emulationFor', () => {
  it('emulates a phone below 768 px', () => {
    expect(emulationFor({ width: 375, height: 812, scale: 2 })).toEqual({
      metrics: { width: 375, height: 812, deviceScaleFactor: 2, mobile: true },
      userAgent: MOBILE_UA,
      touch: true,
    });
  });

  it('keeps a desktop browser from 768 px up', () => {
    expect(emulationFor({ width: 768, height: 1024, scale: 1.75 })).toEqual({
      metrics: {
        width: 768,
        height: 1024,
        deviceScaleFactor: 1.75,
        mobile: false,
      },
      userAgent: null,
      touch: false,
    });
  });

  it('names a mobile Chrome in its user agent', () => {
    expect(MOBILE_UA).toMatch(/Android/);
    expect(MOBILE_UA).toMatch(/Mobile Safari/);
  });
});
