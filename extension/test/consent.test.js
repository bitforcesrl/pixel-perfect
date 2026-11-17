import { describe, expect, it } from 'vitest';
import { allow, isAllowed, revoke, targetKey } from '../src/lib/consent.js';

const APP = 'http://localhost:7654';
const SHOP = 'https://shop.example.com';

describe('consent', () => {
  it('allows a pair once approved', () => {
    const list = allow([], APP, SHOP);
    expect(isAllowed(list, APP, SHOP)).toBe(true);
  });

  it('does not extend an approval to another app origin', () => {
    const list = allow([], APP, SHOP);
    expect(isAllowed(list, 'http://localhost:3000', SHOP)).toBe(false);
  });

  it('does not extend an approval to another site', () => {
    const list = allow([], APP, SHOP);
    expect(isAllowed(list, APP, 'https://mail.example.com')).toBe(false);
  });

  it('keeps one entry per pair', () => {
    expect(allow(allow([], APP, SHOP), APP, SHOP)).toHaveLength(1);
  });

  it('revokes a pair', () => {
    const list = revoke(allow([], APP, SHOP), APP, SHOP);
    expect(isAllowed(list, APP, SHOP)).toBe(false);
  });

  it('keys a site by its origin', () => {
    expect(targetKey('https://a.com/x?y=1#z')).toBe('https://a.com');
  });
});
