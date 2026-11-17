/**
 * The extension's service worker: the one place that drives the browser.
 *
 * - Pages of the app connect through the bridge (a Port named `pp-bridge`)
 *   and ask for captures; each runs in a window of its own (`capture/run.js`).
 * - The toolbar popup asks to open the current site in the app ("flow B").
 * - The confirm window answers whether a site may be captured.
 */
import { attach } from './capture/cdp.js';
import { captureViewport } from './capture/capture-viewport.js';
import { createRunner } from './capture/run.js';
import {
  DEFAULT_APP_MATCHES,
  DEFAULT_APP_URL,
  isDefaultAppOrigin,
  matchPatternFor,
} from './lib/app-origins.js';
import { parseCaptureRequest, PORT_NAME, refuseUrl } from './lib/protocol.js';

/** `chrome.storage.local` keys. */
const KEYS = {
  allowedSites: 'allowedSites',
  appOrigins: 'appOrigins',
  appUrl: 'appUrl',
};
const EXTRA_BRIDGE_ID = 'bridge-extra';
const INCOMING_PREFIX = 'incoming:';

// ── Settings ────────────────────────────────────────────────────────────────

async function readLocal(key, fallback) {
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? fallback;
}

async function extraAppOrigins() {
  return readLocal(KEYS.appOrigins, []);
}

async function appUrl() {
  return readLocal(KEYS.appUrl, DEFAULT_APP_URL);
}

async function isAppOrigin(origin) {
  if (!origin) return false;
  if (isDefaultAppOrigin(origin)) return true;
  return (await extraAppOrigins()).includes(origin);
}

/**
 * Inject the bridge on the app origins the user added in the options. Those
 * are optional host permissions, so the manifest cannot list them; the
 * registration is redone on every start in case it was lost.
 */
async function syncExtraBridge() {
  const origins = await extraAppOrigins();
  const granted = [];
  for (const origin of origins) {
    const pattern = matchPatternFor(origin);
    if (await chrome.permissions.contains({ origins: [pattern] })) {
      granted.push(pattern);
    }
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [EXTRA_BRIDGE_ID],
  });
  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [EXTRA_BRIDGE_ID] });
  }
  if (granted.length === 0) return;
  await chrome.scripting.registerContentScripts([
    {
      id: EXTRA_BRIDGE_ID,
      matches: granted,
      js: ['src/bridge.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
}

chrome.runtime.onInstalled.addListener(() => void syncExtraBridge());
chrome.runtime.onStartup.addListener(() => void syncExtraBridge());

// ── Site consent ────────────────────────────────────────────────────────────

let nextConsentId = 1;
/** Open confirm windows: id → { windowId, resolve }. */
const consents = new Map();

async function askConsent({ appOrigin, targetOrigin }) {
  const id = String(nextConsentId++);
  const params = new URLSearchParams({
    id,
    app: appOrigin,
    target: targetOrigin,
  });
  const answer = new Promise((resolve) => consents.set(id, { resolve }));
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL(`src/ui/confirm.html?${params}`),
    type: 'popup',
    width: 440,
    height: 340,
    focused: true,
  });
  consents.get(id).windowId = window.id;
  return answer;
}

function settleConsent(id, answer) {
  const pending = consents.get(id);
  if (!pending) return;
  consents.delete(id);
  pending.resolve(answer);
}

// Closing the confirm window is a "no"
chrome.windows.onRemoved.addListener((windowId) => {
  for (const [id, pending] of consents) {
    if (pending.windowId === windowId) {
      settleConsent(id, { allowed: false, remember: false });
    }
  }
});

// ── Capture ─────────────────────────────────────────────────────────────────

const runner = createRunner({
  async openWindow() {
    const window = await chrome.windows.create({
      url: 'about:blank',
      type: 'popup',
      width: 480,
      height: 760,
      focused: true,
    });
    return { windowId: window.id, tabId: window.tabs[0].id };
  },
  closeWindow: (windowId) => chrome.windows.remove(windowId),
  attach,
  captureViewport,
  getAllowList: () => readLocal(KEYS.allowedSites, []),
  saveAllowList: (list) =>
    chrome.storage.local.set({ [KEYS.allowedSites]: list }),
  askConsent,
});

/**
 * Send one message back to the page; a capture goes one strip per message,
 * so no single message carries a whole page.
 */
function post(port, message) {
  try {
    if (message.type === 'result') {
      const { strips, ...rest } = message;
      strips.forEach((strip, index) => {
        port.postMessage({
          ...rest,
          type: 'result-strip',
          index,
          total: strips.length,
          strip,
        });
      });
      return;
    }
    port.postMessage(message);
  } catch {
    // The page went away; the run is aborted by the disconnect handler
  }
}

async function focusTab(tab) {
  if (!tab) return;
  await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== PORT_NAME) return;
  const appOrigin = port.sender?.origin;
  if (!(await isAppOrigin(appOrigin))) {
    port.disconnect();
    return;
  }
  /** Runs started from this page: requestId → AbortController. */
  const runs = new Map();
  port.onDisconnect.addListener(() => {
    for (const controller of runs.values()) controller.abort();
  });
  port.onMessage.addListener((message) => {
    if (message?.type === 'cancel') {
      runs.get(message.requestId)?.abort();
      return;
    }
    if (message?.type !== 'capture') return;
    const parsed = parseCaptureRequest(message);
    if (!parsed.ok) {
      post(port, {
        type: 'rejected',
        requestId: message.requestId,
        message: parsed.error,
      });
      return;
    }
    const { requestId } = parsed.value;
    const controller = new AbortController();
    runs.set(requestId, controller);
    void runner
      .run(
        parsed.value,
        { appOrigin },
        (event) => post(port, { ...event, requestId }),
        controller.signal,
      )
      .finally(() => {
        runs.delete(requestId);
        void focusTab(port.sender?.tab);
      });
  });
});

// ── Open in Pixel Perfect (toolbar popup) ───────────────────────────────────

async function appMatchPatterns() {
  return [
    ...DEFAULT_APP_MATCHES,
    ...(await extraAppOrigins()).map(matchPatternFor),
  ];
}

/** An open tab of the app, the configured address's origin first. */
async function findAppTab() {
  const preferred = new URL(await appUrl()).origin;
  const tabs = await chrome.tabs.query({ url: await appMatchPatterns() });
  const ofApp = tabs.filter((tab) => {
    try {
      return new URL(tab.url).pathname.startsWith('/app');
    } catch {
      return false;
    }
  });
  return (
    ofApp.find((tab) => new URL(tab.url).origin === preferred) ??
    ofApp[0] ??
    null
  );
}

async function openInApp({ url, title }) {
  const refused = refuseUrl(url);
  if (refused) return { ok: false, error: refused };
  const incoming = { type: 'incoming', url, title: title ?? '' };

  let tab = await findAppTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: await appUrl(), active: true });
    // The bridge collects it with `ready` once the page has loaded
    await chrome.storage.session.set({ [INCOMING_PREFIX + tab.id]: incoming });
    return { ok: true };
  }
  await focusTab(tab);
  try {
    await chrome.tabs.sendMessage(tab.id, incoming);
  } catch {
    // The tab was open before the extension was installed or reloaded, so it
    // has no bridge yet: reload it and hand the site over once it is back
    await chrome.storage.session.set({ [INCOMING_PREFIX + tab.id]: incoming });
    await chrome.tabs.reload(tab.id);
  }
  return { ok: true };
}

/** A page of this extension (popup, options, confirm), not a web page. */
const fromExtensionPage = (sender) =>
  sender.id === chrome.runtime.id &&
  typeof sender.url === 'string' &&
  sender.url.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // From the confirm window
  if (message?.type === 'consent-answer' && fromExtensionPage(sender)) {
    settleConsent(message.id, {
      allowed: message.allowed === true,
      remember: message.remember === true,
    });
    return false;
  }
  // From the toolbar popup
  if (message?.type === 'open-in-app' && fromExtensionPage(sender)) {
    openInApp(message).then(sendResponse, (err) =>
      sendResponse({ ok: false, error: String(err?.message ?? err) }),
    );
    return true;
  }
  // From the options page, after granting a new app origin
  if (message?.type === 'app-origins-changed' && fromExtensionPage(sender)) {
    syncExtraBridge().then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err?.message ?? err) }),
    );
    return true;
  }
  // From a bridge that just loaded: a site waiting to be opened in this tab
  if (message?.type === 'ready' && sender.tab && !fromExtensionPage(sender)) {
    const key = INCOMING_PREFIX + sender.tab.id;
    chrome.storage.session.get(key).then(async (stored) => {
      if (stored[key]) await chrome.storage.session.remove(key);
      sendResponse(stored[key] ?? null);
    });
    return true;
  }
  return false;
});
