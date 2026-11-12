/**
 * Sends the installed app to the tool when it launches on the public site.
 *
 * The manifest already starts the app at `/app`, but some installs open on
 * `/` anyway: Safari's "Add to Dock" and installs made before the manifest
 * existed keep the URL of the page they were made from. Opened as an
 * installed app, the landing page has nothing to offer, so it hands over to
 * the tool.
 *
 * It is an inline script rather than an effect so it runs while the HTML is
 * still being parsed: the redirect happens before the site paints, with no
 * flash of the landing page.
 *
 * Only a launch is redirected. A page reached from inside the app (a link with
 * a same-origin referrer) is left alone, so the site stays reachable on
 * purpose, and in-app client navigations never run this script at all.
 */
const SCRIPT = `(function () {
  try {
    var installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true;
    if (!installed) return;
    var from = document.referrer;
    if (from && new URL(from).origin === window.location.origin) return;
    window.location.replace('/app');
  } catch (err) {
    // Never block the landing page: without the redirect it still works.
    console.warn('Installed app redirect skipped:', err);
  }
})();`;

export default function InstalledAppRedirect() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
