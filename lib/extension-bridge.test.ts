import { describe, expect, it } from 'vitest';
import {
  OUTDATED_EXTENSION_MESSAGE,
  captureWithExtension,
  detectExtension,
  extensionOutdated,
  subscribeIncoming,
} from './extension-bridge';

const ORIGIN = 'http://localhost:7654';
const EXT = 'pixel-perfect-extension';

type Listener = (event: {
  source: unknown;
  origin: string;
  data: unknown;
}) => void;

/**
 * A stand-in for `window`: what the page posts is recorded and handed to
 * `respond`, which plays the extension's bridge.
 */
function fakeWindow(
  respond: (data: Record<string, unknown>, win: FakeWindow) => void = () => {},
) {
  const listeners = new Set<Listener>();
  const win = {
    location: { origin: ORIGIN },
    posted: [] as Record<string, unknown>[],
    addEventListener: (_: 'message', listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_: 'message', listener: Listener) =>
      listeners.delete(listener),
    postMessage(data: Record<string, unknown>) {
      win.posted.push(data);
      // Delivered asynchronously, as the browser does
      queueMicrotask(() => {
        for (const listener of [...listeners])
          listener({ source: win, origin: ORIGIN, data });
        if (data.source === 'pixel-perfect-app') respond(data, win);
      });
    },
    /** The extension sends something to the page. */
    fromExtension(data: Record<string, unknown>) {
      win.postMessage({ source: EXT, ...data });
    },
  };
  return win;
}
type FakeWindow = ReturnType<typeof fakeWindow>;

const asWindow = (win: FakeWindow) => win as unknown as Window;

describe('detectExtension', () => {
  it('detects the extension', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type === 'hello')
        w.fromExtension({
          type: 'hello-reply',
          version: '1.0.0',
          channel: 'dev',
          instance: 'abc',
        });
    });
    expect(await detectExtension(200, asWindow(win))).toEqual({
      version: '1.0.0',
      channel: 'dev',
      instance: 'abc',
    });
  });

  it('answers null when nothing replies', async () => {
    expect(await detectExtension(30, asWindow(fakeWindow()))).toBeNull();
  });

  it('ignores a second extension', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type !== 'hello') return;
      w.fromExtension({
        type: 'hello-reply',
        version: '1.0.0',
        channel: 'dev',
        instance: 'dev-copy',
      });
      w.fromExtension({
        type: 'hello-reply',
        version: '1.0.0',
        channel: 'store',
        instance: 'store-copy',
      });
    });
    expect((await detectExtension(200, asWindow(win)))?.instance).toBe(
      'dev-copy',
    );
  });
});

describe('captureWithExtension', () => {
  const request = {
    url: 'https://shop.com/',
    viewports: [
      { key: 'mobile', width: 375, height: 812, scale: 2 },
      { key: 'desktop', width: 1440, height: 900, scale: 2 },
    ],
  };

  it('streams results and resolves on done', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type !== 'capture') return;
      const requestId = data.requestId;
      w.fromExtension({
        instance: 'abc',
        requestId,
        type: 'progress',
        key: 'mobile',
      });
      w.fromExtension({
        instance: 'abc',
        requestId,
        type: 'result',
        key: 'mobile',
        strips: [{ height: 10, data: 'data:m' }],
        width: 375,
        height: 2000,
      });
      w.fromExtension({
        instance: 'abc',
        requestId,
        type: 'error',
        key: 'desktop',
        message: 'Timed out',
      });
      w.fromExtension({ instance: 'abc', requestId, type: 'done' });
    });
    const events: string[] = [];
    await captureWithExtension(
      request,
      {
        onProgress: (key) => events.push(`progress ${key}`),
        onResult: (key, shot) =>
          events.push(
            `result ${key} ${shot.strips[0].data} ${shot.width}x${shot.height}`,
          ),
        onError: (key, message) => events.push(`error ${key} ${message}`),
      },
      {
        instance: 'abc',
        signal: new AbortController().signal,
        target: asWindow(win),
      },
    );
    expect(events).toEqual([
      'progress mobile',
      'result mobile data:m 375x2000',
      'error desktop Timed out',
    ]);
  });

  it('reports an outdated extension that sends one PNG as image', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type !== 'capture') return;
      const requestId = data.requestId;
      w.fromExtension({
        instance: 'abc',
        requestId,
        type: 'result',
        key: 'mobile',
        image: 'data:image/png;base64,AAAA',
        width: 375,
        height: 2000,
      });
      w.fromExtension({ instance: 'abc', requestId, type: 'done' });
    });
    const events: string[] = [];
    await captureWithExtension(
      request,
      {
        onProgress: () => {},
        onResult: (key) => events.push(`result ${key}`),
        onError: (key, message) => events.push(`error ${key} ${message}`),
      },
      {
        instance: 'abc',
        signal: new AbortController().signal,
        target: asWindow(win),
      },
    );
    expect(events).toEqual([`error mobile ${OUTDATED_EXTENSION_MESSAGE}`]);
  });

  it('ignores a second extension during a capture', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type !== 'capture') return;
      const requestId = data.requestId;
      w.fromExtension({
        instance: 'other',
        requestId,
        type: 'result',
        key: 'mobile',
        strips: [{ height: 10, data: 'data:x' }],
        width: 1,
        height: 1,
      });
      w.fromExtension({ instance: 'other', requestId, type: 'done' });
      w.fromExtension({
        instance: 'abc',
        requestId,
        type: 'result',
        key: 'mobile',
        strips: [{ height: 10, data: 'data:m' }],
        width: 375,
        height: 2000,
      });
      w.fromExtension({ instance: 'abc', requestId, type: 'done' });
    });
    const images: string[] = [];
    await captureWithExtension(
      request,
      {
        onProgress: () => {},
        onResult: (_, shot) => images.push(shot.strips[0].data),
        onError: () => {},
      },
      {
        instance: 'abc',
        signal: new AbortController().signal,
        target: asWindow(win),
      },
    );
    expect(images).toEqual(['data:m']);
  });

  it('fails every viewport when the request is rejected', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type === 'capture')
        w.fromExtension({
          instance: 'abc',
          requestId: data.requestId,
          type: 'rejected',
          message: 'The extension stopped. Capture again.',
        });
    });
    const errors: string[] = [];
    await captureWithExtension(
      request,
      {
        onProgress: () => {},
        onResult: () => {},
        onError: (key, message) => errors.push(`${key}: ${message}`),
      },
      {
        instance: 'abc',
        signal: new AbortController().signal,
        target: asWindow(win),
      },
    );
    expect(errors).toEqual([
      'mobile: The extension stopped. Capture again.',
      'desktop: The extension stopped. Capture again.',
    ]);
  });

  it('cancels', async () => {
    const controller = new AbortController();
    const win = fakeWindow((data, w) => {
      if (data.type === 'capture') controller.abort();
      if (data.type === 'cancel')
        w.fromExtension({
          instance: 'abc',
          requestId: data.requestId,
          type: 'done',
        });
    });
    await captureWithExtension(
      request,
      { onProgress: () => {}, onResult: () => {}, onError: () => {} },
      { instance: 'abc', signal: controller.signal, target: asWindow(win) },
    );
    const capture = win.posted.find((m) => m.type === 'capture');
    expect(win.posted).toContainEqual({
      source: 'pixel-perfect-app',
      type: 'cancel',
      requestId: capture?.requestId,
    });
  });
});

describe('subscribeIncoming', () => {
  it('hands over a site sent from the toolbar and acknowledges it', async () => {
    const win = fakeWindow((data, w) => {
      if (data.type === 'incoming-request')
        w.fromExtension({
          instance: 'abc',
          type: 'incoming',
          url: 'https://shop.com/a',
          title: 'A',
        });
    });
    const got: string[] = [];
    const stop = subscribeIncoming(
      (msg) => got.push(`${msg.url} ${msg.title}`),
      asWindow(win),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    stop();
    expect(got).toEqual(['https://shop.com/a A']);
    expect(win.posted).toContainEqual({
      source: 'pixel-perfect-app',
      type: 'incoming-ack',
    });
  });
});

describe('extensionOutdated', () => {
  const info = (version: string) => ({
    version,
    channel: 'store' as const,
    instance: 'abc',
  });

  it('flags versions older than the capture protocol', () => {
    expect(extensionOutdated(info('1.0.0'))).toBe(true);
    expect(extensionOutdated(info('0.9.9'))).toBe(true);
    expect(extensionOutdated(info(''))).toBe(true);
  });

  it('accepts the minimum version and newer', () => {
    expect(extensionOutdated(info('1.1.0'))).toBe(false);
    expect(extensionOutdated(info('1.1'))).toBe(false);
    expect(extensionOutdated(info('1.10.0'))).toBe(false);
    expect(extensionOutdated(info('2.0.0'))).toBe(false);
  });
});
