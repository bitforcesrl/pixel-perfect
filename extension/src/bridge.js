/**
 * The bridge between a Pixel Perfect page and the extension.
 *
 * Injected only on the app's origins. The page and the bridge talk with
 * `window.postMessage`, so the app never needs to know the extension's id
 * (which differs between a local copy and the Web Store one). The bridge and
 * the service worker talk over a Port.
 *
 * A content script cannot be an ES module, so the few protocol names it needs
 * are repeated here; `src/lib/protocol.js` holds the full description.
 */
(() => {
  const APP_SOURCE = 'pixel-perfect-app';
  const EXT_SOURCE = 'pixel-perfect-extension';
  const PORT_NAME = 'pp-bridge';

  const manifest = chrome.runtime.getManifest();
  const info = {
    version: manifest.version,
    // A Web Store install carries an update URL; a copy loaded unpacked does not
    channel: 'update_url' in manifest ? 'store' : 'dev',
    instance: chrome.runtime.id,
  };

  const toPage = (message) =>
    window.postMessage(
      { source: EXT_SOURCE, instance: info.instance, ...message },
      window.location.origin,
    );

  // ── Port to the service worker, opened on the first capture ──────────────

  let port = null;
  /** Captures in flight, so a lost connection can end them. */
  const active = new Set();
  /** Strips of captures still arriving: `${requestId}:${key}` → strip[]. */
  const strips = new Map();

  function connect() {
    if (port) return port;
    port = chrome.runtime.connect({ name: PORT_NAME });
    port.onMessage.addListener(fromWorker);
    port.onDisconnect.addListener(() => {
      port = null;
      strips.clear();
      // The service worker stopped (extension reloaded or updated): tell the
      // page instead of leaving its viewports spinning
      for (const requestId of active) {
        toPage({
          type: 'rejected',
          requestId,
          message: 'The extension stopped. Capture again.',
        });
      }
      active.clear();
    });
    return port;
  }

  function fromWorker(message) {
    // A capture comes strip by strip: handed to the page once all are here
    if (message.type === 'result-strip') {
      const id = `${message.requestId}:${message.key}`;
      const list = strips.get(id) ?? [];
      list[message.index] = message.strip;
      strips.set(id, list);
      if (list.filter((strip) => strip !== undefined).length < message.total) {
        return;
      }
      strips.delete(id);
      toPage({
        type: 'result',
        requestId: message.requestId,
        key: message.key,
        width: message.width,
        height: message.height,
        pixelWidth: message.pixelWidth,
        pixelHeight: message.pixelHeight,
        strips: list,
      });
      return;
    }
    if (message.type === 'done' || message.type === 'rejected') {
      active.delete(message.requestId);
    }
    toPage(message);
  }

  // ── Messages from the page ────────────────────────────────────────────────

  /** A site sent from the toolbar before the app was listening. */
  let waitingIncoming = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    const message = event.data;
    if (!message || message.source !== APP_SOURCE) return;

    switch (message.type) {
      case 'hello':
        toPage({ type: 'hello-reply', ...info });
        return;
      case 'capture':
        active.add(message.requestId);
        try {
          connect().postMessage(message);
        } catch {
          active.delete(message.requestId);
          toPage({
            type: 'rejected',
            requestId: message.requestId,
            message: 'The extension is not reachable. Reload the page.',
          });
        }
        return;
      case 'cancel':
        port?.postMessage(message);
        return;
      case 'incoming-request':
        if (waitingIncoming) toPage(waitingIncoming);
        return;
      case 'incoming-ack':
        waitingIncoming = null;
        return;
      default:
    }
  });

  // ── "Open in Pixel Perfect" from the toolbar ──────────────────────────────

  const deliver = (incoming) => {
    const message = {
      type: 'incoming',
      url: incoming.url,
      title: incoming.title,
    };
    // Kept until the app acknowledges it, in case it has not mounted yet
    waitingIncoming = message;
    toPage(message);
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'incoming') deliver(message);
  });

  // A site may have been sent while this tab was opening or reloading
  chrome.runtime
    .sendMessage({ type: 'ready' })
    .then((incoming) => {
      if (incoming) deliver(incoming);
    })
    .catch(() => {});
})();
