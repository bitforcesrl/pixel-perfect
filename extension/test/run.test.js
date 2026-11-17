import { describe, expect, it, vi } from 'vitest';
import { createRunner } from '../src/capture/run.js';

const APP = 'http://localhost:7654';
const URL_ = 'https://shop.example.com/products/a';
const SHOP = 'https://shop.example.com';
const VIEWPORTS = [
  { key: 'mobile', width: 375, height: 812 },
  { key: 'desktop', width: 1440, height: 900 },
];

const shot = (viewport) => ({
  strips: [{ height: 3000, data: viewport.key }],
  width: viewport.width,
  height: 3000,
});

/** Fake browser around the runner. `overrides` replace any dependency. */
function setup(overrides = {}) {
  let detachListener = null;
  const cdp = {
    onDetach: (listener) => {
      detachListener = listener;
      return () => {};
    },
    detach: vi.fn(async () => {}),
  };
  const state = { allowList: [{ app: APP, target: SHOP, at: 0 }] };
  const deps = {
    openWindow: vi.fn(async () => ({ windowId: 1, tabId: 2 })),
    closeWindow: vi.fn(async () => {}),
    attach: vi.fn(async () => cdp),
    captureViewport: vi.fn(async (_cdp, { viewport }) => shot(viewport)),
    getAllowList: vi.fn(async () => state.allowList),
    saveAllowList: vi.fn(async (list) => {
      state.allowList = list;
    }),
    askConsent: vi.fn(async () => ({ allowed: true, remember: true })),
    viewportTimeoutMs: 90_000,
    ...overrides,
  };
  const messages = [];
  const emit = (message) => messages.push(message);
  return {
    deps,
    cdp,
    state,
    messages,
    emit,
    fireDetach: () => detachListener?.('canceled_by_user'),
  };
}

const request = (viewports = VIEWPORTS) => ({
  requestId: 'r1',
  url: URL_,
  viewports,
});

describe('createRunner', () => {
  it('captures every viewport in order', async () => {
    const { deps, messages, emit } = setup();
    await createRunner(deps).run(
      request(),
      { appOrigin: APP },
      emit,
      new AbortController().signal,
    );
    expect(messages).toEqual([
      { type: 'progress', key: 'mobile', status: 'capturing' },
      { type: 'result', key: 'mobile', ...shot(VIEWPORTS[0]) },
      { type: 'progress', key: 'desktop', status: 'capturing' },
      { type: 'result', key: 'desktop', ...shot(VIEWPORTS[1]) },
      { type: 'done' },
    ]);
    expect(deps.openWindow).toHaveBeenCalledTimes(1);
    expect(deps.closeWindow).toHaveBeenCalledWith(1);
  });

  it('asks before an unapproved site', async () => {
    const { deps, state, messages, emit } = setup({
      askConsent: vi.fn(async () => ({ allowed: false, remember: false })),
    });
    state.allowList = [];
    await createRunner(deps).run(
      request(),
      { appOrigin: APP },
      emit,
      new AbortController().signal,
    );
    expect(deps.askConsent).toHaveBeenCalledWith({
      appOrigin: APP,
      targetOrigin: SHOP,
    });
    expect(deps.openWindow).not.toHaveBeenCalled();
    const message = `Capture cancelled: ${SHOP} was not allowed.`;
    expect(messages).toEqual([
      { type: 'error', key: 'mobile', message },
      { type: 'error', key: 'desktop', message },
      { type: 'done' },
    ]);
  });

  it('remembers an approved site', async () => {
    const { deps, state, emit } = setup();
    state.allowList = [];
    const runner = createRunner(deps);
    const signal = new AbortController().signal;
    await runner.run(request(), { appOrigin: APP }, emit, signal);
    expect(deps.saveAllowList).toHaveBeenCalledTimes(1);
    expect(state.allowList).toEqual([
      expect.objectContaining({ app: APP, target: SHOP }),
    ]);
    await runner.run(request(), { appOrigin: APP }, emit, signal);
    expect(deps.askConsent).toHaveBeenCalledTimes(1);
  });

  it('captures once without remembering when asked not to', async () => {
    const { deps, state, messages, emit } = setup({
      askConsent: vi.fn(async () => ({ allowed: true, remember: false })),
    });
    state.allowList = [];
    await createRunner(deps).run(
      request(),
      { appOrigin: APP },
      emit,
      new AbortController().signal,
    );
    expect(deps.saveAllowList).not.toHaveBeenCalled();
    expect(messages.filter((m) => m.type === 'result')).toHaveLength(2);
  });

  it('times out a stuck viewport and continues', async () => {
    const { deps, messages, emit } = setup({
      viewportTimeoutMs: 20,
      captureViewport: vi.fn(async (_cdp, { viewport }) =>
        viewport.key === 'mobile' ? new Promise(() => {}) : shot(viewport),
      ),
    });
    await createRunner(deps).run(
      request(),
      { appOrigin: APP },
      emit,
      new AbortController().signal,
    );
    expect(messages).toContainEqual({
      type: 'error',
      key: 'mobile',
      message: 'Timed out after 0 s',
    });
    expect(messages).toContainEqual({
      type: 'result',
      key: 'desktop',
      ...shot(VIEWPORTS[1]),
    });
    expect(messages.at(-1)).toEqual({ type: 'done' });
  });

  it('reports detach as error for the rest', async () => {
    const harness = setup();
    harness.deps.captureViewport = vi.fn(
      () =>
        new Promise(() => {
          // The user closes the window while the first viewport is loading
          setTimeout(harness.fireDetach, 0);
        }),
    );
    harness.deps.closeWindow = vi.fn(async () => {
      throw new Error('No window with id: 1');
    });
    await createRunner(harness.deps).run(
      request(),
      { appOrigin: APP },
      harness.emit,
      new AbortController().signal,
    );
    expect(harness.messages).toEqual([
      { type: 'progress', key: 'mobile', status: 'capturing' },
      { type: 'error', key: 'mobile', message: 'Capture window was closed' },
      { type: 'error', key: 'desktop', message: 'Capture window was closed' },
      { type: 'done' },
    ]);
    expect(harness.deps.captureViewport).toHaveBeenCalledTimes(1);
  });

  it('aborts on signal', async () => {
    const controller = new AbortController();
    const { deps, messages, emit } = setup({
      captureViewport: vi.fn(async (_cdp, { viewport }) => {
        controller.abort();
        return shot(viewport);
      }),
    });
    await createRunner(deps).run(
      request(),
      { appOrigin: APP },
      emit,
      controller.signal,
    );
    expect(deps.captureViewport).toHaveBeenCalledTimes(1);
    expect(deps.closeWindow).toHaveBeenCalledWith(1);
    expect(messages.at(-1)).toEqual({ type: 'done' });
    expect(messages.filter((m) => m.type === 'result')).toHaveLength(0);
  });
});
