import { describe, expect, it } from 'vitest';
import { renderScaleFor as appScale } from '../../lib/render-scale';
import {
  emulationFor,
  MOBILE_UA,
  renderScaleFor,
} from '../src/lib/emulation.js';

describe('renderScaleFor', () => {
  it('matches the app, so captures and Figma exports share a density', () => {
    for (const width of [200, 375, 448, 600, 768, 1024, 1440, 1920]) {
      expect(renderScaleFor(width), String(width)).toBe(appScale(width));
    }
  });
});

describe('emulationFor', () => {
  it('emulates a phone below 768 px', () => {
    expect(emulationFor({ width: 375, height: 812 })).toEqual({
      metrics: { width: 375, height: 812, deviceScaleFactor: 2, mobile: true },
      userAgent: MOBILE_UA,
      touch: true,
    });
  });

  it('keeps a desktop browser from 768 px up', () => {
    expect(emulationFor({ width: 768, height: 1024 })).toEqual({
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
