/**
 * Which sites each app origin may capture.
 *
 * The bridge answers on every localhost port, so any local dev server could
 * ask for a capture — of the user's webmail, say, with their session. A site
 * is captured only once the user has allowed it for that app origin. The list
 * is plain data (stored in `chrome.storage.local`); these functions never
 * mutate it.
 */

/** The origin a site is approved under. */
export function targetKey(url) {
  return new URL(url).origin;
}

export function isAllowed(list, appOrigin, targetOrigin) {
  return list.some(
    (entry) => entry.app === appOrigin && entry.target === targetOrigin,
  );
}

export function allow(list, appOrigin, targetOrigin, at = Date.now()) {
  if (isAllowed(list, appOrigin, targetOrigin)) return list;
  return [...list, { app: appOrigin, target: targetOrigin, at }];
}

export function revoke(list, appOrigin, targetOrigin) {
  return list.filter(
    (entry) => !(entry.app === appOrigin && entry.target === targetOrigin),
  );
}
