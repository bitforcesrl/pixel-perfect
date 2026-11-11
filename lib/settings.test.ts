import { describe, expect, it } from 'vitest';
import {
  allPresets,
  DEFAULT_SETTINGS,
  enabledPresets,
  isLastEnabled,
  sanitizeSettings,
  type ViewportSettings,
} from './settings';

/** DEFAULT_SETTINGS with the named viewports turned off. */
const only = (...keys: Array<keyof ViewportSettings>): ViewportSettings => ({
  mobile: { ...DEFAULT_SETTINGS.mobile, enabled: keys.includes('mobile') },
  tablet: { ...DEFAULT_SETTINGS.tablet, enabled: keys.includes('tablet') },
  desktop: { ...DEFAULT_SETTINGS.desktop, enabled: keys.includes('desktop') },
});

describe('DEFAULT_SETTINGS', () => {
  it("keeps today's sizes, with tablet off", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mobile: { label: 'Mobile', enabled: true, width: 375, height: 812 },
      tablet: { label: 'Tablet', enabled: false, width: 768, height: 1024 },
      desktop: { label: 'Desktop', enabled: true, width: 1440, height: 900 },
    });
  });
});

describe('sanitizeSettings', () => {
  it('accepts a well-formed record unchanged', () => {
    const stored = only('mobile', 'desktop');
    expect(sanitizeSettings(stored)).toEqual(stored);
  });

  it('falls back to the defaults for anything that is not a record', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps only the viewports the record has, labelled from the defaults', () => {
    const stored = {
      mobile: { enabled: false, width: 390, height: 844 },
      desktop: { enabled: true, width: 1440, height: 900 },
    };
    const settings = sanitizeSettings(stored);
    expect(settings.mobile).toEqual({
      label: 'Mobile',
      enabled: false,
      width: 390,
      height: 844,
    });
    expect(settings.tablet).toBeUndefined();
    expect(settings.desktop).toEqual(DEFAULT_SETTINGS.desktop);
  });

  it('replaces a wrongly typed field with that viewport default', () => {
    const settings = sanitizeSettings({
      mobile: { enabled: 'yes', width: '390', height: 844 },
    });
    expect(settings.mobile).toEqual({
      label: 'Mobile',
      enabled: true,
      width: 375,
      height: 844,
    });
  });

  it('clamps dimensions to the range the API accepts', () => {
    const settings = sanitizeSettings({
      mobile: { enabled: true, width: 12, height: 99_999 },
      desktop: { enabled: true, width: 1280.6, height: 900 },
    });
    expect(settings.mobile.width).toBe(200);
    expect(settings.mobile.height).toBe(4000);
    expect(settings.desktop.width).toBe(1281);
  });

  it('replaces a non-finite dimension with the default', () => {
    const settings = sanitizeSettings({
      tablet: {
        enabled: true,
        width: Number.NaN,
        height: Number.POSITIVE_INFINITY,
      },
    });
    // The stored `enabled` still stands — only the dimensions fall back
    expect(settings.tablet).toEqual({
      ...DEFAULT_SETTINGS.tablet,
      enabled: true,
    });
  });

  it('returns the defaults when the record enables nothing', () => {
    expect(sanitizeSettings(only())).toEqual(DEFAULT_SETTINGS);
  });
});

describe('isLastEnabled', () => {
  it('is true for the only enabled viewport', () => {
    expect(isLastEnabled(only('tablet'), 'tablet')).toBe(true);
  });

  it('is false while another viewport is still enabled', () => {
    expect(isLastEnabled(only('tablet', 'desktop'), 'tablet')).toBe(false);
    expect(isLastEnabled(DEFAULT_SETTINGS, 'mobile')).toBe(false);
  });

  it('is false for a viewport that is already disabled', () => {
    expect(isLastEnabled(only('tablet'), 'mobile')).toBe(false);
  });
});

describe('enabledPresets', () => {
  it('returns the enabled viewports, ascending by width', () => {
    // Tablet is off by default, so it is absent here but present in allPresets
    expect(enabledPresets(DEFAULT_SETTINGS)).toEqual([
      { key: 'mobile', label: 'Mobile', width: 375, height: 812 },
      { key: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ]);
    expect(enabledPresets(only('mobile', 'tablet', 'desktop'))).toEqual([
      { key: 'mobile', label: 'Mobile', width: 375, height: 812 },
      { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
      { key: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ]);
  });

  it('leaves out the disabled ones', () => {
    expect(enabledPresets(only('mobile', 'desktop')).map((p) => p.key)).toEqual(
      ['mobile', 'desktop'],
    );
  });

  it('sorts by the configured width, not by key order', () => {
    const settings: ViewportSettings = {
      ...only('mobile', 'tablet', 'desktop'),
      desktop: { label: 'Desktop', enabled: true, width: 500, height: 900 },
    };
    expect(enabledPresets(settings).map((p) => p.key)).toEqual([
      'mobile',
      'desktop',
      'tablet',
    ]);
  });
});

describe('allPresets', () => {
  it('returns every viewport, enabled or not, ascending by width', () => {
    expect(allPresets(DEFAULT_SETTINGS)).toEqual([
      { key: 'mobile', label: 'Mobile', width: 375, height: 812 },
      { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
      { key: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ]);
  });

  it('includes disabled viewports so Figma routing always sees the full set', () => {
    expect(allPresets(only('desktop')).map((p) => p.key)).toEqual([
      'mobile',
      'tablet',
      'desktop',
    ]);
  });

  it('sorts by the configured width, not by key order', () => {
    const settings: ViewportSettings = {
      ...DEFAULT_SETTINGS,
      desktop: { label: 'Desktop', enabled: false, width: 500, height: 900 },
    };
    expect(allPresets(settings).map((p) => p.key)).toEqual([
      'mobile',
      'desktop',
      'tablet',
    ]);
  });
});
