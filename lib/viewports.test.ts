import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, allPresets, enabledPresets } from './settings';
import {
  VIEWPORT_KEYS,
  assignViewport,
  createSlot,
  createSlots,
  fillSlots,
  firstReadyViewport,
  isSlotReady,
  type ViewportPreset,
  type ViewportSlot,
} from './viewports';

// Every viewport at its default size, tablet included — it ships disabled, and
// these cases are about width, not about what is switched on
const ALL = allPresets(DEFAULT_SETTINGS); // 375 / 768 / 1440

/** The named viewports at the default sizes, ascending by width. */
const some = (
  ...keys: Array<'mobile' | 'tablet' | 'desktop'>
): ViewportPreset[] =>
  ALL.filter((preset) => (keys as string[]).includes(preset.key));

const slot = (overrides: Partial<ViewportSlot> = {}): ViewportSlot => ({
  ...createSlot(),
  ...overrides,
});

const ready = () =>
  slot({
    screenshot: { image: 'data:image/png;base64,x', width: 375, height: 900 },
    figmaSrc: 'blob:figma',
    figmaFileName: 'figma.png',
    status: 'ready',
  });

describe('assignViewport', () => {
  it('routes an export to the preset whose width is nearest', () => {
    expect(assignViewport(375, ALL)).toBe('mobile');
    expect(assignViewport(768, ALL)).toBe('tablet');
    expect(assignViewport(1440, ALL)).toBe('desktop');
  });

  it('puts the boundary at the midpoint between two presets', () => {
    // midpoint of 375 and 768 is 571.5
    expect(assignViewport(571, ALL)).toBe('mobile');
    expect(assignViewport(572, ALL)).toBe('tablet');
    // midpoint of 768 and 1440 is 1104
    expect(assignViewport(1103, ALL)).toBe('tablet');
    expect(assignViewport(1105, ALL)).toBe('desktop');
  });

  it('follows the configured widths rather than fixed thresholds', () => {
    const presets = enabledPresets({
      ...DEFAULT_SETTINGS,
      tablet: { ...DEFAULT_SETTINGS.tablet, enabled: true },
      desktop: { label: 'Desktop', enabled: true, width: 1024, height: 900 },
    });
    // 1024 would have been tablet under the old 1100 threshold
    expect(assignViewport(1024, presets)).toBe('desktop');
    expect(assignViewport(950, presets)).toBe('desktop');
  });

  it('returns the nearest among the given presets, even when some are missing', () => {
    // The caller is responsible for passing all viewports when routing Figma
    // exports.  When a subset is passed the function still picks the nearest.
    expect(assignViewport(768, some('mobile', 'desktop'))).toBe('mobile');
    expect(assignViewport(2880, some('mobile'))).toBe('mobile');
    expect(assignViewport(320, some('desktop'))).toBe('desktop');
  });

  it('sends extremes to the nearest end', () => {
    expect(assignViewport(1, ALL)).toBe('mobile');
    expect(assignViewport(9999, ALL)).toBe('desktop');
  });
});

describe('createSlots', () => {
  it('starts every viewport empty and idle', () => {
    const slots = fillSlots(createSlots(), VIEWPORT_KEYS);
    expect(Object.keys(slots)).toEqual([...VIEWPORT_KEYS]);
    for (const key of VIEWPORT_KEYS) {
      expect(slots[key]).toEqual({
        screenshot: null,
        figmaSrc: null,
        figmaFileName: null,
        figmaHeight: null,
        offsetY: 0,
        status: 'idle',
        error: null,
      });
    }
  });
});

describe('isSlotReady', () => {
  it('requires both a screenshot and a Figma export', () => {
    expect(isSlotReady(ready())).toBe(true);
    expect(isSlotReady(slot({ figmaSrc: 'blob:figma' }))).toBe(false);
    expect(
      isSlotReady(
        slot({ screenshot: { image: 'x', width: 375, height: 900 } }),
      ),
    ).toBe(false);
    expect(isSlotReady(slot())).toBe(false);
  });
});

describe('firstReadyViewport', () => {
  it('keeps the preferred viewport when it is ready and enabled', () => {
    const slots = { ...createSlots(), mobile: ready(), desktop: ready() };
    expect(firstReadyViewport(slots, 'desktop', ALL)).toBe('desktop');
  });

  it('falls back to the first ready viewport by width', () => {
    const slots = { ...createSlots(), tablet: ready() };
    expect(firstReadyViewport(slots, 'desktop', ALL)).toBe('tablet');
  });

  it('refuses a ready viewport that is disabled', () => {
    const slots = { ...createSlots(), desktop: ready(), mobile: ready() };
    expect(firstReadyViewport(slots, 'desktop', some('mobile'))).toBe('mobile');
    expect(firstReadyViewport(slots, 'desktop', some('tablet'))).toBeNull();
  });

  it('returns null when nothing is ready', () => {
    expect(firstReadyViewport(createSlots(), 'mobile', ALL)).toBeNull();
  });

  it('tolerates a null preference', () => {
    const slots = { ...createSlots(), desktop: ready() };
    expect(firstReadyViewport(slots, null, ALL)).toBe('desktop');
  });
});
