import { describe, expect, it } from 'vitest';
import {
  fitScale,
  MAX_CAPTURE_HEIGHT,
  planSlices,
  SLICE_MAX,
} from '../src/lib/slices.js';

const total = (slices) => slices.reduce((sum, slice) => sum + slice.height, 0);
const contiguous = (slices) =>
  slices.every((slice, i) =>
    i === 0
      ? slice.y === 0
      : slice.y === slices[i - 1].y + slices[i - 1].height,
  );

describe('fitScale', () => {
  it('drops to 1x when the tall side would not fit a canvas', () => {
    expect(fitScale(375, 20000, 2)).toBe(1);
  });

  it('keeps the asked scale when it fits', () => {
    expect(fitScale(375, 10000, 2)).toBe(2);
  });

  it('keeps the scale right at the canvas limit', () => {
    // 16383 x 2 = 32766 device px, one under the limit
    expect(fitScale(375, 16383, 2)).toBe(2);
    expect(fitScale(375, 16384, 2)).toBe(1);
  });

  it('leaves 1x alone', () => {
    expect(fitScale(1440, 30000, 1)).toBe(1);
  });
});

describe('planSlices', () => {
  it('covers the page in contiguous slices a GPU can draw', () => {
    const slices = planSlices(10000, 2);
    expect(total(slices)).toBe(10000);
    expect(contiguous(slices)).toBe(true);
    for (const slice of slices) {
      expect(slice.height * 2).toBeLessThanOrEqual(SLICE_MAX);
    }
  });

  it('stops at the capture height cap', () => {
    const slices = planSlices(50000, 1);
    expect(total(slices)).toBe(MAX_CAPTURE_HEIGHT);
    expect(contiguous(slices)).toBe(true);
  });

  it('cuts on whole device pixels at fractional densities', () => {
    for (const slice of planSlices(20000, 1.75).slice(0, -1)) {
      expect(Number.isInteger(slice.y * 1.75), String(slice.y)).toBe(true);
      expect(Number.isInteger(slice.height * 1.75)).toBe(true);
    }
  });

  it('takes a short page in one slice', () => {
    expect(planSlices(900, 1)).toEqual([{ y: 0, height: 900 }]);
  });
});
