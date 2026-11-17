import { describe, expect, it } from 'vitest';
import {
  MAX_CAPTURE_HEIGHT,
  planStripSlices,
  SLICE_MAX,
} from '../src/lib/slices.js';

const planSlices = (cssHeight, scale) =>
  planStripSlices(cssHeight, scale, 2048).slices;

const total = (slices) => slices.reduce((sum, slice) => sum + slice.height, 0);
const contiguous = (slices) =>
  slices.every((slice, i) =>
    i === 0
      ? slice.y === 0
      : slice.y === slices[i - 1].y + slices[i - 1].height,
  );

describe('planStripSlices', () => {
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

  it('makes every slice a whole number of strips', () => {
    const { slices, stripCss } = planStripSlices(20000, 1.75, 2048);
    for (const slice of slices.slice(0, -1)) {
      expect(slice.height % stripCss).toBe(0);
    }
    expect(stripCss * 1.75).toBeLessThanOrEqual(2048);
  });

  it('takes a short page in one slice', () => {
    expect(planSlices(900, 1)).toEqual([{ y: 0, height: 900 }]);
  });
});
