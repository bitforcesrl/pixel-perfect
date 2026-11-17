# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Versions before 1.0.0 were public betas (`-beta.N`); 1.0.0 is the first
> stable release.

## [Unreleased]

## [2.1.0] - 2026-11-17

### Added

- Pages can be created from a Claude Design file: drop its PNG export (Export ▸ All artboards (.png)) in File ▸ Pages ▸ Claude, pick the screens, and each becomes a page with its design already loaded, stored as WebP, on the viewport its title names (`Home – Desktop`, `Home – Mobile`). Importing again updates the pages with the same name.
- The docs explain that the design layer can come from Claude Design or any tool that exports images, not only Figma.
- The Layers panel can delete a layer on every viewport at once: the bin's ▾ menu ▸ All viewports, after a confirmation.

### Changed

- A project holds up to 24 pages instead of 6.
- File ▸ Pages has two tabs, Figma (the page cards) and Claude (the Claude Design import), and the New page card is now the first in the grid, so it stays in reach with many pages.
- The Layers panel's Capture buttons have a ▾ menu with This viewport and All viewports, replacing the separate All buttons; the site row's Chrome button is now called Capture.
- On a high-density (Retina) screen, site captures and Figma exports are taken at 2x on every viewport, desktop included, so text stays sharp at 100%; on a standard screen the scale still slides from 2x on mobile to 1x on desktop.
- The dialog shown when capturing without the extension, Capture ▸ Install the Chrome extension… and the docs now send you to the Chrome Web Store to add the extension.
- Site captures land faster and keep their full sharpness on very tall pages: the Chrome extension now hands over the capture already compressed, with no second compression in the app.

### Fixed

- Capturing with an older copy of the Chrome extension (1.0.0) now asks you to update it, instead of failing every viewport with "The extension sent a capture that could not be read". The extension is now 1.1.0.
- The Chrome extension captures sites you zoom in or out in Chrome at the viewport's real width, instead of failing with "The page would not render at 1440 px".

## [2.0.0] - 2026-11-17

### Added

- Sites are captured automatically by the new Pixel Perfect Capture extension for Chrome, in your own browser and session: logins, store passwords and cookie choices carry over, and localhost, staging and logged-in pages work from the hosted app too.
- From any site, the extension's toolbar button ▸ Open in Pixel Perfect opens the page that compares it (or creates one) and captures it.
- Without the extension, the Chrome and All capture buttons stay in place and open a dialog with the link to install it.
- The docs have a section on automatic site capture with the Chrome extension.
- The public site's home page has an FAQ section, linked from the header, answering common questions about the tool, privacy, capture, limits and maintenance; search engines also get it as structured data.

### Changed

- The walkthrough video on the public site's home page starts muted; the speaker button in its controls turns the soundtrack on.
- The public site's menu stays at the top of the window while you scroll, on the home page and in the docs.

### Removed

- Cloud capture through Browserless and the Browserless key setting.
- Local capture with the browser on the app's machine (the Local button and ⇧L) and the Browser login for pages behind a login: sign in to the site in Chrome instead.
- The Site password page field: enter the password in Chrome once, then capture.

## [1.0.0] - 2026-11-12

### Added

- The app's menu bar has a GitHub link in the top-right corner.
- The public site's header shows GitHub's Star button with the project's star count.
- The public site now lives at pixelperfect.fit.
- Links to the site shared on social networks and chat apps show a preview card with the title, tagline and a screenshot.
- Search engines get richer results for the site and the docs, while the app and demo screens are kept out of search results.
- AI assistants can read a plain-text summary of the project and its documentation at /llms.txt.
- The public site's home page has a walkthrough video of the app, with play controls and fullscreen; it loads only when you press play.
- Each of the four comparison modes on the public site now shows a short looping clip of the real app instead of a still screenshot.
- A banner warns when browser storage is nearly full, or when a change could not be saved because it is full, with a shortcut to the Projects list to free space.
- Opening the demo again when you already have a copy asks whether to open your copy as it is or start over from a fresh one.

### Changed

- A browser keeps up to 6 projects, each with up to 6 pages; importing a larger project keeps its first 6 pages and says so.
- Importing a project with the same name as one you already have asks before replacing it, instead of adding a duplicate.
- Removing a viewport, or resetting viewports to their defaults, asks for confirmation first, since it deletes that viewport's layers on every page.
- Exported project ZIPs no longer include site passwords.
- "Reset everything" now also forgets the Figma token saved in this browser.
- Dragging the Figma layer or a guide, and moving the opacity and zoom sliders, is smoother.
- Large Figma frames that are rendered in slices are ready sooner and take less memory.
- Cloud captures of viewports narrower than 768 px are taken at the same scale as the Figma export (2x on mobile), so both layers are equally sharp; captures also arrive much lighter, and a page too tall for 2x falls back to 1x on its own.

### Fixed

- A project import that fails part way no longer leaves unused data behind in browser storage.
- Revisiting the demo in the same session no longer brings back a demo project you had deleted or edited.
- The app can no longer be embedded in another site, and responses carry stricter browser security headers.
- Figma renders passed through the app are only ever served as images.
- Page URLs are no longer sent to the server for the browser-login check on deployments where browser login is unavailable.

## [0.4.0-beta.1] - 2026-11-12

### Added

- Cloud site capture with Browserless is back: on a public deployment the first capture asks for your own browserless.io API token, saved in this browser with the app's settings; a self-hosted install can provide one for everyone instead.
- While captures or Figma exports run, a progress sheet lists every viewport with its Figma and site status and locks the app until the run ends; a Stop button ends it early, keeping what is already done.
- Documentation at /docs, with screenshots: projects, pages, viewports, every way to load the Figma and site layers, and each panel.
- A ? icon on each inspector panel opens that panel's section of the documentation in a new tab, and Help ▸ Documentation opens the whole guide.
- The public site's header and footer link to the documentation.

### Changed

- The keyboard shortcuts list shows the "capture on this machine" shortcuts only where they work (when the app runs locally).
- Running the project (locally or with Docker) now requires Node.js 26 and npm 11.11 or later.
- Figma export buttons and shortcuts no longer promise a fixed 2x scale, since the scale follows the viewport width.
- Capturing the site or exporting from Figma for the current viewport now takes Shift (⇧C, ⇧L, ⇧M), so a stray key can no longer replace a layer.
- Capturing or exporting every viewport has no keyboard shortcut any more, and asks for confirmation when it would replace captures or Figma exports already in place.
- The landing page and the README now describe cloud capture with Browserless alongside local capture.

### Fixed

- The installed app now always opens on the tool instead of the public website.
- The keyboard shortcuts list now includes S (save the Figma export to History) and I (upload Figma exports).
- The message for a dropped file that is not an image now lists every accepted format, and the empty canvas points to the Layers panel instead of a button that no longer exists.

## [0.3.0-beta.1] - 2026-11-12

### Added

- New brand mark (two ink discs out of register over a crosshair) in the app menu bar, the site header and the app icons.
- Installable app (PWA): web app manifest, icons and a service worker, so Pixel Perfect can be installed as a desktop app.
- "New version available" toast: open tabs check `/api/version` on load, every 10 minutes and when they regain focus, and offer a one-click update.
- Upload buttons in the Layers panel for Figma exports and site screenshots, with automatic placement on the right viewport.

### Changed

- Figma exports at 2x now land on the correct viewport.
- The service worker never pins a tab to an old build: pages are network-first, only content-hashed `/_next/static` files are cached, and updating clears the worker and its caches before reloading.

## [0.2.0-beta.1] - 2026-11-11

### Added

- Public website at `/`, presenting the project, with video slots for each comparison mode.
- Live demo at `/demo`: imports a sample project into the browser and opens it in the app.
- GitHub Discussions with a "Feature request" form, to propose and vote on new ideas.

### Changed

- The app moved from `/` to `/app`.

### Removed

- Password gate for public deployments (`SITE_PASSWORD`, `/api/auth`). The API routes are now open:
  on a public deployment leave `BROWSERLESS_TOKEN` and `FIGMA_TOKEN` unset, so each user brings their own key.

## [0.1.0] - 2026-11-11

### Added

- First public release under the MIT License.
- Four comparison modes: Split, Overlay (with blend modes), Tap and Side by side with synced scrolling.
- Drag & drop of Figma exports and site screenshots, per viewport.
- Figma frame export at 2x through the Figma REST API.
- Local full-page site capture with Playwright, including pages behind a login.
- Projects, pages, custom viewports, guides, pen drawings, notes and snapshot history.
- Project export and import as ZIP, and diff map download.
- Optional password gate for public deployments.

[Unreleased]: https://github.com/bitforcesrl/pixel-perfect/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/bitforcesrl/pixel-perfect/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/bitforcesrl/pixel-perfect/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.4.0-beta.1...v1.0.0
[0.4.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.3.0-beta.1...v0.4.0-beta.1
[0.3.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.2.0-beta.1...v0.3.0-beta.1
[0.2.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/bitforcesrl/pixel-perfect/releases/tag/v0.1.0
