import { describe, expect, it } from 'vitest';
import { elapsedLabel, savedAtLabel } from './elapsed';

const NOW = 1_700_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('elapsedLabel', () => {
  it('calls anything under a minute "just now"', () => {
    expect(elapsedLabel(NOW, NOW)).toBe('just now');
    expect(elapsedLabel(NOW - 59 * SECOND, NOW)).toBe('just now');
  });

  it('counts whole minutes below an hour', () => {
    expect(elapsedLabel(NOW - 3 * MINUTE, NOW)).toBe('3m ago');
    expect(elapsedLabel(NOW - 59 * MINUTE, NOW)).toBe('59m ago');
  });

  it('counts whole hours below a day', () => {
    expect(elapsedLabel(NOW - 2 * HOUR, NOW)).toBe('2h ago');
    expect(elapsedLabel(NOW - 23 * HOUR, NOW)).toBe('23h ago');
  });

  it('counts whole days above that', () => {
    expect(elapsedLabel(NOW - DAY, NOW)).toBe('1d ago');
    expect(elapsedLabel(NOW - 12 * DAY, NOW)).toBe('12d ago');
  });

  it('never goes negative on a clock that moved backwards', () => {
    expect(elapsedLabel(NOW + 5 * MINUTE, NOW)).toBe('just now');
  });
});

describe('savedAtLabel', () => {
  // Built through the local constructor, so the expectations hold in any zone
  const at = (...parts: [number, number, number, number, number]) =>
    new Date(...parts).getTime();

  it('reads as date then time', () => {
    expect(savedAtLabel(at(2026, 6, 29, 14, 32))).toBe('2026-07-29 14:32');
  });

  it('pads every field to a fixed width', () => {
    expect(savedAtLabel(at(2026, 0, 5, 9, 7))).toBe('2026-01-05 09:07');
  });

  it('keeps midnight on the 24-hour clock', () => {
    expect(savedAtLabel(at(2026, 11, 31, 0, 0))).toBe('2026-12-31 00:00');
  });
});
