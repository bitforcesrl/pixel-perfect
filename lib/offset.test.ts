import { describe, expect, it } from 'vitest';
import { bottomAlignOffset, clampOffset, offsetBounds } from './offset';

describe('offsetBounds', () => {
  it('bounds the drag by the measured Figma height', () => {
    expect(offsetBounds(900, 2400)).toEqual({ min: -2400, max: 900 });
  });

  it('falls back to the screenshot height when Figma is unmeasured', () => {
    expect(offsetBounds(900, null)).toEqual({ min: -900, max: 900 });
  });
});

describe('clampOffset', () => {
  it('keeps values inside the bounds', () => {
    expect(clampOffset(-120, 900, 2400)).toBe(-120);
  });

  it('clamps past the top bound', () => {
    expect(clampOffset(-5000, 900, 2400)).toBe(-2400);
  });

  it('clamps past the bottom bound', () => {
    expect(clampOffset(5000, 900, 2400)).toBe(900);
  });

  it('rounds to whole pixels', () => {
    expect(clampOffset(-12.6, 900, 2400)).toBe(-13);
  });
});

describe('bottomAlignOffset', () => {
  it('offsets a tall Figma export upwards', () => {
    expect(bottomAlignOffset(900, 2400)).toBe(-1500);
  });

  it('offsets a short Figma export downwards', () => {
    expect(bottomAlignOffset(900, 400)).toBe(500);
  });

  it('is a no-op when Figma is unmeasured', () => {
    expect(bottomAlignOffset(900, null)).toBe(0);
  });
});
