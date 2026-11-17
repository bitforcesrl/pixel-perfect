/**
 * One capture request from the app, start to finish.
 *
 * The site must be allowed for the app origin that asked (once per pair, see
 * `consent.js`); then a window is opened for the capture, every viewport is
 * taken in turn, and the window goes away again — whatever happened.
 *
 * Every browser-facing step comes in through `deps`, so the order of events,
 * the timeouts and the cleanup can be tested without a browser.
 */
import { allow, isAllowed, targetKey } from '../lib/consent.js';
import { WINDOW_CLOSED } from './cdp.js';

export const VIEWPORT_TIMEOUT_MS = 90_000;

class Detached extends Error {}
class TimedOut extends Error {}

const messageOf = (err) => (err instanceof Error ? err.message : String(err));

/**
 * @param deps.openWindow () → Promise<{ windowId, tabId }>
 * @param deps.closeWindow (windowId) → Promise
 * @param deps.attach (tabId) → Promise<Cdp>
 * @param deps.captureViewport (cdp, { url, viewport }, { deadline, signal })
 * @param deps.getAllowList / deps.saveAllowList the consent list
 * @param deps.askConsent ({ appOrigin, targetOrigin }) → Promise<{ allowed, remember }>
 * @param deps.viewportTimeoutMs per-viewport cap, 90 s by default
 */
export function createRunner(deps) {
  const timeoutMs = deps.viewportTimeoutMs ?? VIEWPORT_TIMEOUT_MS;

  /** True once the user has allowed `targetOrigin` for `appOrigin`. */
  async function consented(appOrigin, targetOrigin) {
    if (isAllowed(await deps.getAllowList(), appOrigin, targetOrigin)) {
      return true;
    }
    const answer = await deps.askConsent({ appOrigin, targetOrigin });
    if (!answer.allowed) return false;
    if (answer.remember) {
      await deps.saveAllowList(
        allow(await deps.getAllowList(), appOrigin, targetOrigin),
      );
    }
    return true;
  }

  /**
   * One viewport, raced against its time cap and against the window going
   * away. The capture itself is told to stop through its own signal, so a
   * timed-out viewport does not keep driving the tab under the next one.
   */
  async function oneViewport(cdp, url, viewport, signal, detached) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal.addEventListener('abort', stop, { once: true });
    let timer;
    try {
      return await Promise.race([
        deps.captureViewport(
          cdp,
          { url, viewport },
          { deadline: Date.now() + timeoutMs, signal: controller.signal },
        ),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new TimedOut(
                  `Timed out after ${Math.round(timeoutMs / 1000)} s`,
                ),
              ),
            timeoutMs,
          );
        }),
        detached,
      ]);
    } finally {
      clearTimeout(timer);
      controller.abort();
      signal.removeEventListener('abort', stop);
    }
  }

  /**
   * @param request a parsed `capture` message (`protocol.js`)
   * @param ctx `{ appOrigin }` of the page that asked
   * @param emit sends one message back to that page
   * @param signal aborts the run (Stop in the app, or the app tab went away)
   */
  async function run(request, ctx, emit, signal) {
    const { url, viewports } = request;
    const targetOrigin = targetKey(url);
    const failAll = (list, message) => {
      for (const viewport of list) {
        emit({ type: 'error', key: viewport.key, message });
      }
    };

    if (!(await consented(ctx.appOrigin, targetOrigin))) {
      failAll(viewports, `Capture cancelled: ${targetOrigin} was not allowed.`);
      emit({ type: 'done' });
      return;
    }
    if (signal.aborted) {
      emit({ type: 'done' });
      return;
    }

    let windowId = null;
    let cdp = null;
    try {
      const opened = await deps.openWindow();
      windowId = opened.windowId;
      cdp = await deps.attach(opened.tabId);
    } catch (err) {
      failAll(viewports, messageOf(err));
      if (windowId !== null) await deps.closeWindow(windowId).catch(() => {});
      emit({ type: 'done' });
      return;
    }

    // Closing the window or cancelling Chrome's debugging bar ends the session
    let markDetached;
    const detached = new Promise((_, reject) => {
      markDetached = () => reject(new Detached(WINDOW_CLOSED));
    });
    detached.catch(() => {});
    cdp.onDetach(() => markDetached());

    try {
      for (let i = 0; i < viewports.length; i++) {
        if (signal.aborted) break;
        const viewport = viewports[i];
        emit({ type: 'progress', key: viewport.key, status: 'capturing' });
        try {
          const shot = await oneViewport(cdp, url, viewport, signal, detached);
          if (signal.aborted) break;
          emit({ type: 'result', key: viewport.key, ...shot });
        } catch (err) {
          if (err instanceof Detached) {
            failAll(viewports.slice(i), WINDOW_CLOSED);
            break;
          }
          if (signal.aborted) break;
          emit({ type: 'error', key: viewport.key, message: messageOf(err) });
        }
      }
    } finally {
      await cdp.detach().catch(() => {});
      await deps.closeWindow(windowId).catch(() => {});
      emit({ type: 'done' });
    }
  }

  return { run };
}
