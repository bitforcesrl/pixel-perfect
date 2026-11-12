# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Beta.** Pixel Perfect is in public beta until 1.0.0. Releases are tagged as
> pre-releases (`-beta.N`), and any minor version may still contain breaking
> changes, always listed under **Removed** or **Changed**.

## [Unreleased]

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

[Unreleased]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.4.0-beta.1...HEAD
[0.4.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.3.0-beta.1...v0.4.0-beta.1
[0.3.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.2.0-beta.1...v0.3.0-beta.1
[0.2.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/bitforcesrl/pixel-perfect/releases/tag/v0.1.0
