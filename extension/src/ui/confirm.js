/**
 * The per-site consent window. The service worker opens it the first time an
 * app origin asks to capture a site, and waits for the answer. Closing the
 * window counts as Cancel.
 */
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

document.getElementById('app').textContent = params.get('app') ?? '';
document.getElementById('target').textContent = params.get('target') ?? '';

async function answer(allowed) {
  await chrome.runtime.sendMessage({
    type: 'consent-answer',
    id,
    allowed,
    remember: document.getElementById('remember').checked,
  });
  window.close();
}

document.getElementById('allow').addEventListener('click', () => answer(true));
document
  .getElementById('cancel')
  .addEventListener('click', () => answer(false));
document.getElementById('allow').focus();
