/**
 * Settings: the app address for "Open in Pixel Perfect", extra app origins
 * (self-hosted copies, preview deployments) and the sites allowed so far.
 */
import {
  DEFAULT_APP_URL,
  isDefaultAppOrigin,
  matchPatternFor,
} from '../lib/app-origins.js';
import { revoke } from '../lib/consent.js';

const manifest = chrome.runtime.getManifest();
document.getElementById('channel').textContent =
  'update_url' in manifest
    ? `v${manifest.version}`
    : `v${manifest.version} dev`;

const get = async (key, fallback) =>
  (await chrome.storage.local.get(key))[key] ?? fallback;
const set = (key, value) => chrome.storage.local.set({ [key]: value });

const httpUrl = (raw) => {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const removeButton = (onClick) => {
  const button = document.createElement('button');
  button.textContent = 'Remove';
  button.addEventListener('click', onClick);
  return button;
};

const item = (text, button) => {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.className = 'host';
  label.textContent = text;
  li.append(label, button);
  return li;
};

const empty = (text) => {
  const li = document.createElement('li');
  li.className = 'muted';
  li.textContent = text;
  return li;
};

// ── App address ─────────────────────────────────────────────────────────────

const appUrlInput = document.getElementById('app-url');
const appUrlStatus = document.getElementById('app-url-status');
appUrlInput.value = await get('appUrl', DEFAULT_APP_URL);

document
  .getElementById('app-url-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = httpUrl(appUrlInput.value);
    if (!url) {
      appUrlStatus.textContent = 'Enter an http or https address.';
      return;
    }
    const origins = await get('appOrigins', []);
    if (!isDefaultAppOrigin(url.origin) && !origins.includes(url.origin)) {
      appUrlStatus.textContent =
        'Add this address under “More Pixel Perfect addresses” first.';
      return;
    }
    await set('appUrl', url.href);
    appUrlStatus.textContent = 'Saved.';
  });

// ── Extra app origins ───────────────────────────────────────────────────────

const originsList = document.getElementById('origins');
const originStatus = document.getElementById('origin-status');

async function renderOrigins() {
  const origins = await get('appOrigins', []);
  originsList.replaceChildren(
    ...(origins.length === 0
      ? [empty('None added.')]
      : origins.map((origin) =>
          item(
            origin,
            removeButton(async () => {
              await set(
                'appOrigins',
                (await get('appOrigins', [])).filter((o) => o !== origin),
              );
              await chrome.permissions
                .remove({ origins: [matchPatternFor(origin)] })
                .catch(() => {});
              await chrome.runtime.sendMessage({
                type: 'app-origins-changed',
              });
              await renderOrigins();
            }),
          ),
        )),
  );
}

document
  .getElementById('origin-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = httpUrl(document.getElementById('origin').value);
    if (!url) {
      originStatus.textContent = 'Enter an http or https address.';
      return;
    }
    if (isDefaultAppOrigin(url.origin)) {
      originStatus.textContent = 'This address already works.';
      return;
    }
    // Must run inside the click: Chrome only shows its prompt for a user gesture
    const granted = await chrome.permissions.request({
      origins: [matchPatternFor(url.origin)],
    });
    if (!granted) {
      originStatus.textContent = 'Not added: Chrome permission was declined.';
      return;
    }
    const origins = await get('appOrigins', []);
    if (!origins.includes(url.origin)) {
      await set('appOrigins', [...origins, url.origin]);
    }
    await chrome.runtime.sendMessage({ type: 'app-origins-changed' });
    document.getElementById('origin').value = '';
    originStatus.textContent = `Added. Reload any open ${url.host} tab.`;
    await renderOrigins();
  });

// ── Allowed sites ───────────────────────────────────────────────────────────

const sitesList = document.getElementById('sites');

async function renderSites() {
  const list = await get('allowedSites', []);
  sitesList.replaceChildren(
    ...(list.length === 0
      ? [empty('No site allowed yet.')]
      : list.map((entry) =>
          item(
            `${entry.target}  ←  ${entry.app}`,
            removeButton(async () => {
              await set(
                'allowedSites',
                revoke(await get('allowedSites', []), entry.app, entry.target),
              );
              await renderSites();
            }),
          ),
        )),
  );
}

await renderOrigins();
await renderSites();
