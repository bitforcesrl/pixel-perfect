import { describe, expect, it } from 'vitest';
import * as scripts from '../src/capture/page-scripts.js';

const PAGE_FUNCTIONS = [
  'hideShopifyPreviewBar',
  'hideOverlays',
  'unwrapScrollContainers',
  'forceEagerRendering',
  'scrollUntilSettled',
  'measureContentHeight',
  'findPasswordGate',
];

describe('page scripts', () => {
  it.each(PAGE_FUNCTIONS)('%s survives being sent as source', (name) => {
    const fn = scripts[name];
    expect(typeof fn).toBe('function');
    // Rebuilt from its text alone, exactly as Runtime.evaluate will see it:
    // anything it used from the module scope would be undefined there.
    const rebuilt = new Function(`return (${fn.toString()})`)();
    expect(typeof rebuilt).toBe('function');
    const imported = Object.keys(scripts).filter(
      (other) => other !== name && other !== 'evalExpression',
    );
    for (const other of imported) {
      expect(fn.toString(), `${name} uses ${other}`).not.toMatch(
        new RegExp(`\\b${other}\\(`),
      );
    }
  });

  it('builds an expression that calls the function with JSON arguments', () => {
    expect(scripts.evalExpression(scripts.scrollUntilSettled, 5000)).toBe(
      `(${scripts.scrollUntilSettled.toString()})(5000)`,
    );
  });

  it('never clicks anything on the page it hides overlays on', () => {
    expect(scripts.hideOverlays.toString()).not.toContain('.click(');
  });
});
