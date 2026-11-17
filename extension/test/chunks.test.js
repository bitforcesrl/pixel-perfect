import { describe, expect, it } from 'vitest';
import { splitIntoChunks } from '../src/lib/chunks.js';

describe('splitIntoChunks', () => {
  it('cuts a string into pieces of the given size', () => {
    expect(splitIntoChunks('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('still sends one piece for an empty string', () => {
    expect(splitIntoChunks('', 3)).toEqual(['']);
  });

  it('joins back to the original', () => {
    const text = 'x'.repeat(1000) + 'y';
    expect(splitIntoChunks(text, 64).join('')).toBe(text);
  });
});
