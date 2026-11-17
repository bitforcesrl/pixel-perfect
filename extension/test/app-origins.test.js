import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_MATCHES,
  isDefaultAppOrigin,
  matchPatternFor,
} from '../src/lib/app-origins.js';

describe('isDefaultAppOrigin', () => {
  it.each([
    ['http://localhost:7654', true],
    ['http://127.0.0.1:3000', true],
    ['http://localhost', true],
    ['https://localhost:7654', false],
    ['https://pixelperfect.fit', true],
    ['https://www.pixelperfect.fit', true],
    ['http://pixelperfect.fit', false],
    ['https://evil.fit', false],
    ['https://pixelperfect.fit.evil.com', false],
  ])('%s → %s', (origin, expected) => {
    expect(isDefaultAppOrigin(origin)).toBe(expected);
  });
});

describe('matchPatternFor', () => {
  it('covers every path of an origin', () => {
    expect(matchPatternFor('https://pp.example.com')).toBe(
      'https://pp.example.com/*',
    );
  });
});

describe('DEFAULT_APP_MATCHES', () => {
  it('lists the four app origins', () => {
    expect(DEFAULT_APP_MATCHES).toHaveLength(4);
  });
});
