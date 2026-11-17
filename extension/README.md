# Pixel Perfect Capture — Chrome extension

Full-page screenshots of a site at every viewport, taken **in your own
Chrome with your session**, delivered straight into Pixel Perfect. It is the
app's only automatic site capture: no key, no server-side browser, no
datacenter IP, and logins, store passwords and cookie choices are simply
already there.

- [What it does](#what-it-does)
- [Folder layout](#folder-layout)
- [Load it locally (developer mode)](#load-it-locally-developer-mode)
- [Test the full loop](#test-the-full-loop)
- [Automated tests](#automated-tests)
- [Build the release zip](#build-the-release-zip)
- [Publish to the Chrome Web Store](#publish-to-the-chrome-web-store)
- [After publishing](#after-publishing)
- [Release an update](#release-an-update)
- [Microsoft Edge Add-ons (optional)](#microsoft-edge-add-ons-optional)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)

## What it does

1. **Capture from the app.** The **Chrome** button on the Site row of the
   Layers panel (without the extension it opens a dialog with the install
   link). Pressing it (or
   _Capture ▸ Capture all enabled viewports_) opens the page in a small window
   of your Chrome, shows it at each viewport of the project, takes full-page
   screenshots and closes the window. The results land on the page like any
   capture.
2. **Capture from any site.** The toolbar icon ▸ **Open in Pixel Perfect**
   sends the current address to the app. The app finds the page that compares
   it (or offers to create one, or a project on a first visit) and captures it.

Along the way:

- The first capture of a site asks **once per site** ("Pixel Perfect at … wants
  to capture …"). It guards against another local dev server asking the
  extension to screenshot, say, your webmail. Allowed sites are listed in the
  extension's settings and can be removed.
- Below 768 px the page is shown as a phone (mobile viewport, mobile user
  agent, touch). Density follows the app's rule: 2x on mobile, sliding to 1x at
  1440 px, the same as the Figma export.
- Cookie banners, newsletter pop-ups and the Shopify preview bar are
  **hidden**, never clicked: nothing is decided on the site on your behalf.
- Lazy images are loaded, smooth-scroll wrappers unwrapped, pages taller than
  a GPU texture captured in slices and stitched (capped at 30 000 px).
- A password gate (401/403 with a password field) is reported instead of
  captured: open the site in Chrome, enter the password, capture again. The
  extension never types passwords.
- Chrome shows **"Pixel Perfect Capture started debugging this browser"** while
  a capture runs. That bar is what the `debugger` permission looks like;
  cancelling it stops the capture.

## Folder layout

```
extension/
  manifest.json            Manifest V3
  src/
    service-worker.js      drives captures, the toolbar flow, consent windows
    bridge.js              content script on Pixel Perfect pages (postMessage ⇄ Port)
    lib/                   protocol, emulation, slicing, consent, origins (pure, tested)
    capture/               chrome.debugger wrapper, page scripts, one-viewport pipeline,
                           stitching, the runner (consent → window → viewports → cleanup)
    ui/                    popup, options, consent window, shared CSS
  icons/                   16/32/48/128 px, built from app/icon.svg
  store/                   listing texts (EN, IT), privacy policy, permission answers,
                           promo tiles, screenshots and their sources (design/)
  scripts/                 icons, zip
  test/                    unit tests (run by the root Vitest)
```

The folder lives inside the app repository but stays out of the app's way:
`tsconfig.json` and ESLint ignore it, the Docker image excludes it, Prettier
formats it and the root `npm test` runs its unit tests. Nothing is built:
the files in `src/` are exactly what Chrome runs and what the store reviews.

The app side is `lib/extension-bridge.ts` (talks to the bridge),
`lib/page-match.ts` (finds the page for an address),
`app/components/useCaptureExtension.ts`,
`app/components/IncomingCaptureDialog.tsx` and the capture code in
`app/components/Workspace.tsx`.

## Load it locally (developer mode)

The same folder is what the store version is built from. Loaded unpacked it
shows **dev** next to its version in the popup and in the app's status bar.

1. Open `chrome://extensions` in Chrome (or Edge, Brave, Arc).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` folder.
4. Pin it: puzzle icon in the toolbar ▸ pin **Pixel Perfect Capture**.

After editing any file in `extension/`, press the **reload** arrow on the
extension's card in `chrome://extensions`, then reload the Pixel Perfect tab
(a page only gets the bridge when it loads).

**Dev and store copies side by side.** Both would answer the app; the app uses
the first that replies. While testing a local copy, turn the store copy off in
`chrome://extensions`.

## Test the full loop

The app needs this branch's code, so test against the app running locally
(pixelperfect.fit only gains extension support once this code is deployed).

1. `npm run dev` (http://localhost:7654).
2. Load the extension unpacked (above) and open http://localhost:7654/app.
   The status bar, bottom right, reads **extension dev 1.0.0** (it reads
   **no extension** while none answers); the Capture menu no longer offers
   "Install the Chrome extension…".
3. In Chrome, open the site you want to test, log in, enter the store
   password, answer the cookie banner, as a visitor would.
4. In Pixel Perfect, set that address on a page (File ▸ Pages) and press
   **Chrome** or _Capture ▸ Capture all enabled viewports_.
5. First time for that site: the consent window opens, press **Allow**.
6. A small window opens, goes through the viewports, closes; the screenshots
   land in the app.
7. Toolbar flow: on any site, click the extension icon ▸ **Open in Pixel
   Perfect**. The app tab comes to the front with the "Open in Pixel Perfect"
   dialog; choose the page or a new one, press **Open and capture**.

Settings (right-click the icon ▸ Options): the Pixel Perfect address the
toolbar opens (set it to `http://localhost:7654/app` while developing), extra
Pixel Perfect addresses (self-hosted copies, preview deployments; Chrome asks
to grant each), allowed sites.

## Automated tests

```bash
npx vitest run extension/test     # unit tests: protocol, emulation, slicing,
                                  # consent, page scripts, the capture runner
```

The root `npm test` runs them too. There is no automated end-to-end test:
check the real extension by hand with [Test the full loop](#test-the-full-loop)
before each release.

## Build the release zip

```bash
npm run extension:icons   # only when app/icon.svg changed: icons + promo tile
npm run extension:zip     # → extension/dist/pixel-perfect-capture-<version>.zip
```

The zip holds `manifest.json`, `src/` and `icons/` only. It refuses to build
while `manifest.json`, `src/` or `icons/` have uncommitted changes, so every
uploaded package matches a commit (`npm run extension:zip -- --force` to
override for a try-out). `extension/dist/` is git-ignored.

## Publish to the Chrome Web Store

Everything to paste is in `store/`. Google's own guides:
[register](https://developer.chrome.com/docs/webstore/register),
[publish](https://developer.chrome.com/docs/webstore/publish),
[review process](https://developer.chrome.com/docs/webstore/review-process).

### 1. Developer account (once)

1. Sign in with the Google account that will own the item (a company account
   or a [group publisher](https://developer.chrome.com/docs/webstore/group-publishers)
   is better than a personal one: the item stays with Bitforce).
2. Turn on **2-Step Verification** on that Google account: the dashboard
   requires it to publish.
3. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   accept the developer agreement and pay the one-time registration fee.
4. In **Account**: set the publisher name, verify the contact email (it cannot
   be changed later), and complete the **trader / non-trader** declaration
   required for the EU. A company publishing its own product declares itself
   a trader and gives its business details.

### 2. Create the item

1. Dashboard ▸ **New item** ▸ upload `extension/dist/pixel-perfect-capture-1.0.0.zip`.
2. **Store listing** tab, from `store/listing.en.md`:
   - Description (the summary comes from the manifest's `description`)
   - Category: **Developer Tools**, language: English
   - Icon: taken from the package (`icons/icon-128.png`)
   - Screenshots: `store/screenshots/*.png`, in order (1280×800, four images)
   - Small promo tile: `store/promo-440x280.png`
   - Marquee promo tile (optional, used if the item is featured):
     `store/marquee-1400x560.png`
   - Homepage: `https://pixelperfect.fit`, support: `https://github.com/bitforcesrl/pixel-perfect/issues`
   - Add the Italian listing from `store/listing.it.md` (Add a language).
3. **Privacy practices** tab, from `store/permissions.md`: single purpose,
   one justification per permission and host permission, "No remote code",
   data usage (Website content) and the three certifications, privacy policy
   URL `https://pixelperfect.fit/extension/privacy`. The privacy page must be
   live, so deploy the app first.
4. **Distribution** tab:
   - Visibility: start with **Unlisted** (installable by link, not in search)
     to let the team try it after review, then switch to **Public**. **Private**
     limits it to listed testers or a Google Workspace domain.
   - Regions: all.
5. **Submit for review.** Leave "publish automatically after approval" on,
   or turn it off to press Publish yourself.

**The store images** (screenshots and promo tiles) are exported from HTML
pages in `store/design/`, which embed the extension's real popup and consent
window. To change or re-export them, see `store/design/README.md`.

### 3. Review

Google says most items are reviewed within a few days, sometimes a few weeks;
contact support after three weeks. A new developer, a new item and the
`debugger` permission all invite a closer look, so plan for 1–3 weeks the
first time. What helps, and is already done here: no `<all_urls>`, readable
unminified code, no remote code, one clear purpose, a justification for each
permission, a public privacy policy and public source.

At install, Chrome warns that the extension can **"Read and change all your
data on all websites"** and **"Access the page debugger backend"**: that is
what the `debugger` permission shows, not a sign of extra permissions.

## After publishing

1. Copy the item's store URL
   (`https://chromewebstore.google.com/detail/pixel-perfect-capture/<id>`).
2. Set it in `lib/features.ts`:
   `export const EXTENSION_STORE_URL: string | null = 'https://…';`
   The app's install dialog (what **Chrome** / **All** open without the
   extension), _Capture ▸ Install the Chrome extension…_ and the docs then
   link to the store instead of the docs' manual install steps.
3. Deploy the app.

## Release an update

1. Bump `version` in `manifest.json` (the store refuses a version that is not
   higher than the published one).
2. Run the unit and end-to-end tests, commit.
3. `npm run extension:zip`.
4. Dashboard ▸ the item ▸ **Package** ▸ Upload new package ▸ submit for
   review. Installed copies update by themselves once it is published.

Adding a permission makes Chrome disable the extension for existing users
until they accept the new warning: avoid it, or say why in the release notes.

## Microsoft Edge Add-ons (optional)

Edge installs from the Chrome Web Store already. To be listed in Edge's own
store, register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/)
(free), upload the same zip, reuse the same texts and privacy URL. Review there
takes up to about seven business days.

## How it works

```
Pixel Perfect page ──postMessage──▶ bridge.js ──Port pp-bridge──▶ service-worker.js
   (lib/extension-bridge.ts)        (content script,              │ consent window (once per site)
                                     app origins only)            │ chrome.windows.create (popup)
                                                                  │ chrome.debugger.attach
        ◀── progress / result / error / done (chunked if large) ──┤ per viewport: emulate, load,
                                                                  │ prepare, slice, stitch
                                                                  └ detach, close window
```

- The app never needs the extension's id, which differs between an unpacked
  copy and the store one: they find each other through the bridge, which is
  injected on `pixelperfect.fit`, `www.pixelperfect.fit`, `localhost` and
  `127.0.0.1` (any port), plus any address added in the settings.
- Messages are tagged `pixel-perfect-app` / `pixel-perfect-extension` and
  carry the extension `instance`; the full list is in `src/lib/protocol.js`.
- The toolbar flow sends `{ url, title }` with `chrome.tabs.sendMessage` to
  an open app tab, or opens the app and hands it over once the page's bridge
  reports `ready`. The app acknowledges it so a remount does not get it twice.
- Each viewport has a 90 s cap. Closing the window or cancelling the debugging
  bar ends the run cleanly; every remaining viewport gets an error.

## Troubleshooting

| Symptom                                 | Cause and fix                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App asks to install the extension       | The page loaded before the extension. Reload the Pixel Perfect tab. On another address than pixelperfect.fit or localhost, add it in the extension's settings. |
| "Capture window was closed"             | The window was closed or the debugging bar's Cancel was pressed. Capture again.                                                                                |
| "This site asks for a password…"        | The store password was not entered in this Chrome profile. Open the site, enter it, capture again.                                                             |
| "Capture cancelled: … was not allowed"  | The consent window was cancelled or closed. Capture again and press Allow.                                                                                     |
| A cookie banner is still in the picture | Its markup carries none of the usual names. Answer it once in Chrome: the site then stops showing it.                                                          |
| Blank areas low on a page               | Content that loads only on interaction. Scroll the page once in Chrome, or raise the waits in `src/capture/capture-viewport.js`.                               |
| Very tall page comes back at 1x         | Above about 16 000 px at 2x the stitched image would not fit a canvas, so it drops to 1x by design.                                                            |
| "The extension stopped. Capture again." | The extension was reloaded or updated mid-capture. Capture again.                                                                                              |
