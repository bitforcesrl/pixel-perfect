/**
 * A small wrapper over `chrome.debugger` for one tab.
 *
 * Chrome shows its "started debugging this browser" bar while attached, and the
 * user can cancel it, or close the window, at any moment: both end up in
 * `onDetach`, after which every `send` rejects instead of hanging.
 */

export const WINDOW_CLOSED = 'Capture window was closed';

export async function attach(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');

  const eventListeners = new Map();
  const detachListeners = new Set();
  let detached = false;

  const handleEvent = (source, method, params) => {
    if (source.tabId !== tabId) return;
    for (const listener of eventListeners.get(method) ?? []) listener(params);
  };
  const handleDetach = (source, reason) => {
    if (source.tabId !== tabId) return;
    detached = true;
    cleanup();
    for (const listener of detachListeners) listener(reason);
  };
  const cleanup = () => {
    chrome.debugger.onEvent.removeListener(handleEvent);
    chrome.debugger.onDetach.removeListener(handleDetach);
  };
  chrome.debugger.onEvent.addListener(handleEvent);
  chrome.debugger.onDetach.addListener(handleDetach);

  return {
    get detached() {
      return detached;
    },
    send(method, params = {}) {
      if (detached) return Promise.reject(new Error(WINDOW_CLOSED));
      return chrome.debugger.sendCommand(target, method, params);
    },
    onEvent(method, listener) {
      if (!eventListeners.has(method)) eventListeners.set(method, new Set());
      eventListeners.get(method).add(listener);
      return () => eventListeners.get(method)?.delete(listener);
    },
    onDetach(listener) {
      detachListeners.add(listener);
      return () => detachListeners.delete(listener);
    },
    async detach() {
      if (detached) return;
      detached = true;
      cleanup();
      await chrome.debugger.detach(target).catch(() => {});
    },
  };
}
