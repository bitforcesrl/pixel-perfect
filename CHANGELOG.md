# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Beta.** Pixel Perfect is in public beta until 1.0.0. Releases are tagged as
> pre-releases (`-beta.N`), and any minor version may still contain breaking
> changes, always listed under **Removed** or **Changed**.

## [Unreleased]

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

[Unreleased]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.2.0-beta.1...HEAD
[0.2.0-beta.1]: https://github.com/bitforcesrl/pixel-perfect/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/bitforcesrl/pixel-perfect/releases/tag/v0.1.0
