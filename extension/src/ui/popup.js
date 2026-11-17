/**
 * The toolbar popup: send the page in the current tab to Pixel Perfect.
 *
 * Only the address and title are sent. The app finds (or creates) the page
 * for it and runs the capture at that project's own viewports.
 */
import { refuseUrl } from '../lib/protocol.js';

const manifest = chrome.runtime.getManifest();
document.getElementById('version').textContent = manifest.version;
document.getElementById('channel').textContent =
  'update_url' in manifest ? 'store' : 'dev';

const host = document.getElementById('host');
const reason = document.getElementById('reason');
const open = document.getElementById('open');

const showReason = (text) => {
  reason.textContent = text;
  reason.hidden = false;
};

// `activeTab` makes the current tab's address readable once the icon is clicked
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const url = tab?.url ?? '';
let parsed = null;
try {
  parsed = new URL(url);
} catch {
  // Left null: shown as "nothing to capture" below
}
host.textContent = parsed ? parsed.host + parsed.pathname : 'No page';

const refused = refuseUrl(url);
if (refused) {
  showReason(refused);
} else {
  open.disabled = false;
}

open.addEventListener('click', async () => {
  open.disabled = true;
  const answer = await chrome.runtime.sendMessage({
    type: 'open-in-app',
    url,
    title: tab?.title ?? '',
  });
  if (answer?.ok) {
    window.close();
    return;
  }
  showReason(answer?.error ?? 'Pixel Perfect could not be opened.');
  open.disabled = false;
});

document.getElementById('options').addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});
