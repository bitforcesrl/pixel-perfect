import type { ScreenshotResult } from './validation';

/**
 * The app's side of the Chrome extension ("Pixel Perfect Capture").
 *
 * The extension injects a bridge on the app's pages; the two talk with
 * `window.postMessage`, so the app never needs the extension's id — which
 * differs between a copy loaded locally and the Web Store one. Every message
 * carries a `source` tag, and every message from the extension carries the
 * `instance` (extension id) that sent it: with two copies installed, the first
 * to answer `hello` is the one the app listens to.
 *
 * The protocol is described in `extension/src/lib/protocol.js`.
 */

const APP_SOURCE = 'pixel-perfect-app';
const EXT_SOURCE = 'pixel-perfect-extension';

export interface ExtensionInfo {
  version: string;
  /** `dev` for a copy loaded unpacked, `store` for the Web Store install. */
  channel: 'dev' | 'store';
  /** The extension's id: which copy answered. */
  instance: string;
}

export interface ExtensionViewport {
  key: string;
  width: number;
  height: number;
}

export interface CaptureHandlers {
  onProgress: (key: string) => void;
  onResult: (key: string, shot: ScreenshotResult) => void;
  onError: (key: string, message: string) => void;
}

export interface IncomingSite {
  url: string;
  title: string;
}

type ExtensionMessage = Record<string, unknown> & { type?: unknown };

/** Listen to what the extension posts on `target`; returns the unsubscribe. */
function listen(
  target: Window,
  onMessage: (data: ExtensionMessage) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== target || event.origin !== target.location.origin) {
      return;
    }
    const data = event.data as ExtensionMessage | null;
    if (!data || data.source !== EXT_SOURCE) return;
    onMessage(data);
  };
  target.addEventListener('message', listener);
  return () => target.removeEventListener('message', listener);
}

function send(target: Window, message: Record<string, unknown>) {
  target.postMessage(
    { source: APP_SOURCE, ...message },
    target.location.origin,
  );
}

/** The installed extension, or null when none answers within `timeoutMs`. */
export function detectExtension(
  timeoutMs = 600,
  target: Window = window,
): Promise<ExtensionInfo | null> {
  return new Promise((resolve) => {
    const finish = (info: ExtensionInfo | null) => {
      clearTimeout(timer);
      stop();
      resolve(info);
    };
    const stop = listen(target, (data) => {
      if (data.type !== 'hello-reply') return;
      finish({
        version: String(data.version ?? ''),
        channel: data.channel === 'store' ? 'store' : 'dev',
        instance: String(data.instance ?? ''),
      });
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    send(target, { type: 'hello' });
  });
}

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Capture `url` at every viewport through the extension. Resolves once the
 * extension says it is done (or turned the request away, in which case every
 * viewport gets the reason). Aborting `signal` asks the extension to stop and
 * still waits for its `done`, so the capture window is closed when this
 * resolves.
 */
export function captureWithExtension(
  req: { url: string; viewports: ExtensionViewport[] },
  handlers: CaptureHandlers,
  opts: { instance: string; signal: AbortSignal; target?: Window },
): Promise<void> {
  const target = opts.target ?? window;
  const requestId = randomId();
  return new Promise((resolve) => {
    const onAbort = () => send(target, { type: 'cancel', requestId });
    const finish = () => {
      stop();
      opts.signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const stop = listen(target, (data) => {
      if (data.instance !== opts.instance || data.requestId !== requestId) {
        return;
      }
      const key = String(data.key ?? '');
      switch (data.type) {
        case 'progress':
          handlers.onProgress(key);
          return;
        case 'result':
          handlers.onResult(key, {
            image: String(data.image),
            width: Number(data.width),
            height: Number(data.height),
          });
          return;
        case 'error':
          handlers.onError(key, String(data.message ?? 'Capture failed'));
          return;
        case 'rejected':
          for (const viewport of req.viewports) {
            handlers.onError(
              viewport.key,
              String(data.message ?? 'Capture failed'),
            );
          }
          finish();
          return;
        case 'done':
          finish();
          return;
        default:
      }
    });
    opts.signal.addEventListener('abort', onAbort, { once: true });
    send(target, {
      type: 'capture',
      requestId,
      url: req.url,
      viewports: req.viewports.map(({ key, width, height }) => ({
        key,
        width,
        height,
      })),
    });
    if (opts.signal.aborted) onAbort();
  });
}

/**
 * Sites sent from the extension's toolbar ("Open in Pixel Perfect"). Asks
 * once for one that arrived before the app was listening, and acknowledges
 * each, so a remount does not receive it twice.
 */
export function subscribeIncoming(
  onIncoming: (site: IncomingSite) => void,
  target: Window = window,
): () => void {
  const stop = listen(target, (data) => {
    if (data.type !== 'incoming' || typeof data.url !== 'string') return;
    send(target, { type: 'incoming-ack' });
    onIncoming({ url: data.url, title: String(data.title ?? '') });
  });
  send(target, { type: 'incoming-request' });
  return stop;
}
