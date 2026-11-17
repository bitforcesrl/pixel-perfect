import { COMPACT_QUALITY } from './encode';
import { TILE_HEIGHT, packTiles, type Tile } from './tile-container';

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

/**
 * Oldest extension that speaks this app's capture protocol (per-viewport
 * `scale`, WebP `strips`). 1.0.0 sends one PNG as `image` instead.
 */
export const MIN_EXTENSION_VERSION = '1.1.0';

export const OUTDATED_EXTENSION_MESSAGE = `Pixel Perfect Capture is out of date: update it to ${MIN_EXTENSION_VERSION} or later, then capture again.`;

/** Numeric parts of `1.2.3`; anything unreadable counts as 0. */
const versionParts = (version: string) =>
  version.split('.').map((part) => Number.parseInt(part, 10) || 0);

/** True when `info` is older than {@link MIN_EXTENSION_VERSION}. */
export function extensionOutdated(info: ExtensionInfo): boolean {
  const have = versionParts(info.version);
  const need = versionParts(MIN_EXTENSION_VERSION);
  for (let i = 0; i < need.length; i++) {
    const a = have[i] ?? 0;
    if (a !== need[i]) return a < need[i];
  }
  return false;
}

export interface ExtensionViewport {
  key: string;
  width: number;
  height: number;
  /** Device px per CSS px to shoot at (`captureScaleFor`) */
  scale: number;
}

/** One strip of a capture, as the extension encodes it: base64 WebP. */
export interface ExtensionStrip {
  /** natural px */
  height: number;
  data: string;
}

/** A capture as the extension hands it over: WebP strips ready to store. */
export interface ExtensionShot {
  /** CSS px */
  width: number;
  height: number;
  /** natural px of the whole picture */
  pixelWidth: number;
  pixelHeight: number;
  strips: ExtensionStrip[];
}

/**
 * How the extension is asked to encode a capture: WebP strips at the quality
 * and height the app stores (`encode.ts`, `tile-container.ts`), so they are
 * packed as they come.
 */
const CAPTURE_ENCODING = {
  quality: COMPACT_QUALITY,
  stripHeight: TILE_HEIGHT,
};

export interface CaptureHandlers {
  onProgress: (key: string) => void;
  onResult: (key: string, shot: ExtensionShot) => void;
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
          // An extension older than this protocol sends one PNG as `image`
          if (!Array.isArray(data.strips) && typeof data.image === 'string') {
            handlers.onError(key, OUTDATED_EXTENSION_MESSAGE);
            return;
          }
          handlers.onResult(key, {
            width: Number(data.width),
            height: Number(data.height),
            pixelWidth: Number(data.pixelWidth),
            pixelHeight: Number(data.pixelHeight),
            strips: Array.isArray(data.strips)
              ? (data.strips as ExtensionStrip[])
              : [],
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
      viewports: req.viewports.map(({ key, width, height, scale }) => ({
        key,
        width,
        height,
        scale,
      })),
      encoding: CAPTURE_ENCODING,
    });
    if (opts.signal.aborted) onAbort();
  });
}

const isStrip = (value: unknown): value is ExtensionStrip =>
  value !== null &&
  typeof value === 'object' &&
  Number.isInteger((value as ExtensionStrip).height) &&
  (value as ExtensionStrip).height > 0 &&
  typeof (value as ExtensionStrip).data === 'string' &&
  (value as ExtensionStrip).data.length > 0;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The stored form of a capture sent as strips: the one WebP when there is a
 * single strip, else the strips packed as they are (`tile-container.ts`) — no
 * decoding, no second lossy pass. Throws on strips that do not add up to the
 * picture they claim to be, rather than storing a broken layer.
 */
export function blobFromStrips(shot: ExtensionShot): Blob {
  const { strips, pixelWidth, pixelHeight } = shot;
  const total = strips.reduce(
    (sum, strip) => (isStrip(strip) ? sum + strip.height : NaN),
    0,
  );
  if (
    strips.length === 0 ||
    !(pixelWidth > 0) ||
    !Number.isInteger(pixelWidth) ||
    total !== pixelHeight
  ) {
    throw new Error('The extension sent a capture that could not be read');
  }
  const mime = 'image/webp';
  const tiles: Tile[] = strips.map((strip) => ({
    height: strip.height,
    blob: new Blob([base64ToBytes(strip.data)], { type: mime }),
  }));
  if (tiles.length === 1) return tiles[0].blob;
  return packTiles({ width: pixelWidth, height: pixelHeight, mime, tiles });
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
