import { describe, expect, it } from 'vitest';
import { figmaScrollTop, siteScrollTop } from './scrollsync';

describe('scrollsync', () => {
  it('maps 1:1 when there is no offset', () => {
    expect(figmaScrollTop(500, 0, 1)).toBe(500);
    expect(siteScrollTop(500, 0, 1)).toBe(500);
  });

  it('pulls the Figma pane up by a positive offset', () => {
    expect(figmaScrollTop(500, 120, 1)).toBe(380);
  });

  it('pushes the Figma pane down by a negative offset', () => {
    expect(figmaScrollTop(500, -80, 1)).toBe(580);
  });

  it('scales the offset by zoom, because the offset is in image pixels', () => {
    expect(figmaScrollTop(500, 120, 2)).toBe(260);
    expect(siteScrollTop(260, 120, 2)).toBe(500);
  });

  it('clamps at the top of the pane', () => {
    expect(figmaScrollTop(50, 120, 1)).toBe(0);
    expect(siteScrollTop(0, -300, 1)).toBe(0);
  });

  it('round-trips an unclamped position', () => {
    expect(siteScrollTop(figmaScrollTop(900, 120, 1.5), 120, 1.5)).toBe(900);
  });
});
