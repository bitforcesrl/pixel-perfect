# Pixel Perfect

[![CI](https://github.com/bitforcesrl/pixel-perfect/actions/workflows/ci.yml/badge.svg)](https://github.com/bitforcesrl/pixel-perfect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-26-339933.svg?logo=node.js&logoColor=white)](.nvmrc)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg?logo=next.js)](https://nextjs.org)
[![GitHub Discussions](https://img.shields.io/github/discussions/bitforcesrl/pixel-perfect?logo=github)](https://github.com/bitforcesrl/pixel-perfect/discussions)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**Website:** [pixelperfect.fit](https://pixelperfect.fit) · **Docs:** [pixelperfect.fit/docs](https://pixelperfect.fit/docs)

> Put the live site and its Figma design on top of each other, and see every pixel that doesn't match.

Pixel Perfect is a web app for **design QA**. For each page and each viewport (mobile, tablet, desktop or your own sizes) it stacks a screenshot of the website over the matching Figma frame, then gives you four ways to compare them, plus tools to align, measure, annotate and share what you find.

Start with two images dragged onto the canvas. Add a Figma token and the design frames are fetched for you. Install the Pixel Perfect Capture extension for Chrome, and the site is captured for you too.

📖 **User guide:** the app ships its own documentation at **`/docs`**, with screenshots of every panel. Each panel's `?` icon opens its section.

💡 **Got an idea or a feature you're missing?** [Propose it in Discussions](https://github.com/bitforcesrl/pixel-perfect/discussions/new?category=feature-request) and vote on the ones you'd like to see next.

---

## Contents

- [Why it exists](#why-it-exists)
- [What it makes easier](#what-it-makes-easier)
- [Three ways to use it](#three-ways-to-use-it)
- [Features](#features)
- [Core concepts](#core-concepts)
- [Documentation](#documentation)
- [Using the hosted version](#using-the-hosted-version)
- [Running it locally](#running-it-locally)
- [Configuration](#configuration)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

---

## Why it exists

Checking an implementation against its design is slow and subjective. You open Figma and the browser side by side, resize the window by hand, eyeball margins and font sizes, take screenshots, mark them up in another tool and paste them into a chat. Precision and time leak out at every step.

Pixel Perfect keeps the whole loop in one place:

1. **Get both layers**: drop in your own screenshots, or let the app fetch Figma frames and capture the site at the exact viewport size.
2. **Compare** them in Split, Overlay, Tap or Side by side.
3. **Align and measure** with pixel offsets, zoom and guides.
4. **Annotate and share**: draw, write notes, and hand over the whole project as a ZIP.

## What it makes easier

### For developers

- **See every kind of drift.** Four comparison modes each catch something different:
  - **Split** for edges and alignment across a draggable divider;
  - **Overlay** with `difference` blending for 1px offsets and color shifts;
  - **Tap** for flipping between the two to spot changes in copy, icons or spacing;
  - **Side by side** with synced scrolling for long pages and layout rhythm.
- **No manual resizing or exporting.** One click captures the page at 375, 768 or 1440 px (or any viewport you define), full-page. Another renders the Figma frame straight from the Figma API, at a scale that follows the viewport width (2x on mobile, down to 1x on desktop; 2x everywhere on a Retina screen).
- **Works on `localhost`.** Compare your branch while you build it, before it's deployed, even on pages behind a login: the extension captures in your own Chrome, with your session.
- **Bug reports with full context.** A tester sends you a ZIP with captures, Figma frames, snapshots and notes, and you open it exactly as they left it.

### For QA testers

- **One tool for design review** instead of Figma + browser + a markup tool + chat.
- **Objective evidence.** A difference map and pixel-exact offsets replace "it looks a bit off".
- **Precise measuring.** Horizontal and vertical guides, vertical offset to the pixel, zoom down to the detail.
- **Repeatable reviews.** Each project keeps its pages, viewports, notes and a history of Figma exports, so you can re-check the same screens after every fix.
- **Nothing to install** on the hosted version: drag two images in and start comparing.

---

## Three ways to use it

| Level                     | Figma layer           | Site layer                                 | Needs                                                 |
| ------------------------- | --------------------- | ------------------------------------------ | ----------------------------------------------------- |
| **1. Drag & drop** (base) | Drop an image export  | Drop a screenshot                          | Nothing: works anywhere                               |
| **2. Figma API**          | Fetched automatically | Drop a screenshot                          | A Figma personal access token                         |
| **3. Fully automatic**    | Fetched automatically | Captured automatically, in your own Chrome | A Figma token and the Pixel Perfect Capture extension |

You can mix them freely: a layer you drop and a layer the app fetched behave exactly the same.

---

## Features

| Area                 | What it does                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Drag & drop**      | Drop images on the canvas (left half = Figma, right half = site) or on a viewport tab, split the same way. PNG, JPEG, WebP, AVIF, GIF and BMP are accepted; a retina screenshot is recognised by its width and shown at the viewport's CSS size. |
| **Figma export**     | Renders a frame through the Figma REST API (2x on mobile, down to 1x on desktop; 2x everywhere on a Retina screen), for the current viewport (`⇧M`) or all of them (menu or **All**).                                                            |
| **Site capture**     | Full-page screenshots at each viewport's exact width, taken by the Pixel Perfect Capture Chrome extension in your own browser and session. Viewports under 768 px are captured as a phone; every capture is at the Figma export's scale.         |
| **Projects & pages** | Up to 6 projects of up to 6 pages each. Each page has a URL and one Figma link per viewport. Gallery with thumbnails.                                                                                                                            |
| **Viewports**        | Mobile, Tablet and Desktop by default. Add, rename, resize or disable them in the settings.                                                                                                                                                      |
| **Comparison modes** | **Split**, **Overlay** (opacity + `normal` or `difference` blending), **Tap**, **Side by side** (synced scroll).                                                                                                                                 |
| **Alignment**        | Pixel vertical offset, align top/bottom, drag the Figma layer, zoom and fit.                                                                                                                                                                     |
| **Annotations**      | Vertical and horizontal guides, a pen with colors and widths, per-page text notes.                                                                                                                                                               |
| **History**          | Save Figma exports as named snapshots to compare design versions over time.                                                                                                                                                                      |
| **Sharing**          | Export/import a whole project as a ZIP: layers, snapshots, notes and settings (guides and drawings stay in the session).                                                                                                                         |
| **Diff map**         | Download the difference image to attach to a ticket.                                                                                                                                                                                             |
| **Persistence**      | Everything is kept in the browser (IndexedDB). Reload and pick up where you left off.                                                                                                                                                            |

## Core concepts

- **Project**: a site or feature under review.
- **Page**: a site URL plus links to its Figma frames, one per viewport. Managed under **File ▸ Pages**.
- **Viewport**: a size (width × height) at which both layers are compared.
- **Layers**: each viewport has two plates, _Figma_ (magenta) and _Site_ (cyan). The **Layers** panel shows the state of each and lets you fetch it again or remove it.

> Data lives **only in the browser you're using**. To move it to another machine or share it, use **File ▸ Export project as ZIP** and **File ▸ Import project from ZIP**. Importing a project with the same name as one you have asks before replacing it. A banner warns when browser storage is nearly full.

## Documentation

The full user guide is part of the app, at **`/docs`** on any deployment (and on `http://localhost:7654/docs` locally): projects, pages and their fields, viewports, every way to load the layers (including how to get a Figma token and how to install the Chrome extension), each inspector panel, sharing and shortcuts. In the app, the `?` at the right of each panel title and **Help ▸ Documentation** open it in a new tab.

---

## Using the hosted version

The hosted version (for example on Vercel) is for anyone without the repo: QA testers, designers, PMs. Everything happens in the browser.

### 1. Open the app

Open the deployment URL and go to `/app`, or start from `/demo` to explore a ready-made project.

### 2. Create a project and its pages

1. **File ▸ New project…** (`N`) and give it a name.
2. **File ▸ Pages…** (`P`) to add the pages you want to review.

### 3. Load the layers by drag & drop (base mode)

1. Pick a viewport from the tabs at the top.
2. Drag your **Figma export** onto the **left half** of the canvas, or onto the viewport's tab.
3. Drag the **site screenshot** onto the **right half** of the canvas.

The drop always goes to the viewport it was aimed at, whatever the image's width. You can also press `I` to pick Figma exports from disk; those are routed to a viewport by their width.

### 4. Optional: fetch Figma frames automatically

Instead of exporting from Figma by hand, add a Figma token once:

1. In Figma, open **Settings ▸ Security ▸ Personal access tokens**.
2. Create a token with the **File content: Read-only** scope.
3. Paste it when the app asks, or via **Capture ▸ Figma token…**. It is stored only in your browser.
4. In **File ▸ Pages**, paste each viewport's frame link (right-click the frame in Figma ▸ **Copy link to selection**).
5. Press **Capture** on the _Figma_ row of the **Layers** panel (`⇧M`), or **All** for every viewport.

> Figma's image-rendering endpoint is tightly rate limited for _View_ and _Collab_ seats. Use a _Dev_ or _Full_ seat.

### 5. Optional: capture the site automatically

Instead of taking screenshots by hand, install the **Pixel Perfect Capture** extension in Chrome (or Edge, Brave, Arc):

1. Install it. Until it is published on the Chrome Web Store, load the [`extension/`](extension) folder unpacked: `chrome://extensions` ▸ **Developer mode** ▸ **Load unpacked**. Then reload Pixel Perfect.
2. Open the site in Chrome once and get it ready as a visitor would: log in, enter the store password, answer the cookie banner.
3. In **File ▸ Pages**, give the page its **Capture URL**.
4. Press **Chrome** on the _Site_ row of the **Layers** panel (`⇧C`), or **All** for every viewport.

The first capture of a site asks you to allow it, once. The page opens in a small window, is captured full-page at each viewport, and the window closes by itself. Without the extension, **Chrome** and **All** open a dialog with the link to install it. Details in [`extension/README.md`](extension/README.md).

### 6. Compare, annotate, share

1. Pick a comparison mode (`1`–`4`).
2. Align with **Offset Y**, zoom and dragging the Figma layer.
3. Mark issues with guides (`G`, `⇧G`), the pen (`D`) and notes.
4. Save the current design with **Save snapshot** (`S`) to compare against later versions.
5. Download the **diff map** (`E`) for the ticket and/or export the project as a ZIP for the developer.

### Typical dev ⇄ QA loop

```text
Developer (local)                         QA (hosted)
─────────────────                         ───────────
auto-capture site + Figma ──► ZIP ──►     import ZIP
                                          compare, annotate, notes
open ZIP, fix the issues  ◄── ZIP ◄──     export ZIP
capture again, verify
```

---

## Running it locally

A copy on your own machine does everything the hosted version does, and lets you set the Figma token once for everyone. Site captures need nothing on the server: they run in the Chrome extension, which answers `localhost` out of the box.

### Requirements

- **Node.js 26** (the version in [`.nvmrc`](.nvmrc))
- **npm 11.11+** (bundled with Node 26; otherwise `npm install -g npm@latest`)

### Install

```bash
git clone https://github.com/bitforcesrl/pixel-perfect.git
cd pixel-perfect
npm install
cp .env.example .env # optional: no variable is required locally
npm run dev
```

Open **http://localhost:7654**.

### Set up automatic capture

1. **Chrome extension**: install it as described [above](#5-optional-capture-the-site-automatically).
2. **Figma token**: set `FIGMA_TOKEN` in `.env`, or paste your own token in the app (see [above](#4-optional-fetch-figma-frames-automatically)).
3. **Pages**: in **File ▸ Pages**, give each page its **Capture URL** and one **Figma frame link** per viewport.
4. **Viewports**: adjust sizes or add new ones under **Capture ▸ Viewport settings…** (`,`).

### Capture

The _Site_ row in the **Layers** panel always shows **Chrome** and **All**: with the extension installed they capture in your Chrome, without it they open a dialog with the link to install it. The status bar, bottom right, shows the extension version that answers (or _no extension_).

Anything that replaces a layer needs **Shift**, so a stray key never overwrites a good capture, and the every-viewport runs have **no key at all**. When an every-viewport run would replace captures or exports already in place, the app asks first.

| Action                             | Button                  | Key  | Menu                                    |
| ---------------------------------- | ----------------------- | ---- | --------------------------------------- |
| Capture the site, current viewport | **Chrome**              | `⇧C` | Capture ▸ Capture _viewport_            |
| Capture the site, every viewport   | **All** (Site row)      | —    | Capture ▸ Capture all enabled viewports |
| Export Figma, current viewport     | **Capture** (Figma row) | `⇧M` | Capture ▸ Export _viewport_ Figma frame |
| Export Figma, every viewport       | **All** (Figma row)     | —    | Capture ▸ Export every Figma frame      |

A site capture opens the page in a small Chrome window at each viewport's exact width, loads lazy images, hides cookie banners and pop-ups (never clicking them) and saves a full-page screenshot. While captures or Figma exports run, the app is locked behind a progress sheet listing every viewport; **Stop** ends the run and keeps what is already done. Since it runs in your own browser, you can capture:

- your dev server (`http://localhost:3000` and so on);
- public or staging sites, and stores behind their password once you have entered it in Chrome;
- pages behind a login, with the session you are already signed in with;
- sites that rate limit by IP. The request leaves from your own connection, not a datacenter.

### Share captures with QA

1. Capture the site and Figma for every page and viewport.
2. **File ▸ Export project as ZIP…**
3. Send the ZIP. The tester imports it in the hosted version, or in their own local copy.

### Production build

```bash
npm run build
npm start            # http://localhost:7654
```

### Docker (optional)

```bash
docker compose up --build   # http://localhost:3000
```

The image runs only the app: site captures happen in each user's Chrome extension. For a copy served on an address other than `localhost` or `pixelperfect.fit`, add that address in the extension's settings (right-click its icon ▸ **Options**).

### Scripts

| Command                           | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| `npm run dev`                     | Dev server on port `7654`                      |
| `npm run build` / `npm start`     | Production build and start                     |
| `npm run lint` / `lint:fix`       | ESLint (report / auto-fix)                     |
| `npm run typecheck`               | TypeScript check, no output                    |
| `npm run format` / `format:check` | Prettier (write / verify)                      |
| `npm test`                        | Tests (Vitest)                                 |
| `npm run check`                   | Lint + typecheck + format check + tests, as CI |
| `npm run extension:zip`           | Build the extension's Web Store zip            |
| `npm run secrets:scan`            | Scan git history for leaked secrets (gitleaks) |

---

## Configuration

Every variable is optional. See [`.env.example`](.env.example) for details.

| Variable      | Purpose                                                            |
| ------------- | ------------------------------------------------------------------ |
| `FIGMA_TOKEN` | A server-wide Figma token. When unset, each user enters their own. |

On a public deployment, leave `FIGMA_TOKEN` unset: the instance is open to anyone, and a server-wide token would be spent by every visitor. Each user then brings their own.

The Chrome Web Store link the app offers is set in [`lib/features.ts`](lib/features.ts) (`EXTENSION_STORE_URL`); until it is set, the app links to the docs section on loading the extension by hand.

### Routes and the demo project

- `/` is the public landing page, `/app` the tool, `/docs` the user guide.
- `/demo` imports `public/demo-project.zip` into the visitor's browser, exactly like **File ▸ Import project from ZIP**, then opens it under `/app`. Coming back to `/demo` when a demo copy exists asks whether to open that copy or start over with a fresh one.
- To update the demo, export a project from the app and overwrite `public/demo-project.zip`.

---

## Keyboard shortcuts

The full list is under **Help ▸ Keyboard shortcuts**. The main ones:

| Key             | Action                                            |
| --------------- | ------------------------------------------------- |
| `1` `2` `3` `4` | Split / Overlay / Tap / Side by side              |
| `I`             | Open Figma exports from disk                      |
| `⇧C`            | Site capture (Chrome extension), current viewport |
| `⇧M`            | Figma export, current viewport                    |
| `+` `-` `f` `0` | Zoom in / out / fit / 100%                        |
| `G` / `⇧G`      | Vertical / horizontal guide                       |
| `D` / `Z`       | Pen / undo last stroke                            |
| `S`             | Save snapshot                                     |
| `E`             | Download diff map                                 |
| `N` / `P`       | New project / pages                               |
| `B`             | Show/hide the inspector                           |

---

## Project structure

```text
app/
  api/            Server routes: figma, version
  (site)/         Public pages: landing (/) and the user guide (/docs)
  components/     React components (Workspace is the smart container; the rest are reusable UI)
lib/              Pure logic: extension bridge, Figma, IndexedDB storage, ZIP, diff, viewports, feature flags
extension/        The Pixel Perfect Capture Chrome extension (see extension/README.md)
scripts/          git hooks (gitleaks pre-commit)
```

Stack: **Next.js 16**, **React 19**, **Tailwind CSS 4**, **Vitest**; the extension is plain Manifest V3 JavaScript.

## Contributing

Contributions are welcome: bug reports, ideas, docs and code. New ideas start in [Discussions](https://github.com/bitforcesrl/pixel-perfect/discussions/categories/feature-request), where the community can vote on them; the ones we pick become issues. Read the [contributing guide](CONTRIBUTING.md) for the setup, code style and pull request process, and run `npm run check` before opening a PR.

Looking for a place to start? Browse the issues labelled [`good first issue`](https://github.com/bitforcesrl/pixel-perfect/labels/good%20first%20issue).

## Community

- 🐛 **Bugs**: [GitHub Issues](https://github.com/bitforcesrl/pixel-perfect/issues)
- 💡 **Feature requests and ideas**: [propose and vote in Discussions](https://github.com/bitforcesrl/pixel-perfect/discussions/categories/feature-request)
- 💬 **Questions and help**: [GitHub Discussions](https://github.com/bitforcesrl/pixel-perfect/discussions)
- 🔒 **Security vulnerabilities**: report them privately as described in [SECURITY.md](SECURITY.md)
- 📝 **What's new**: [CHANGELOG.md](CHANGELOG.md)

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

> Pixel Perfect is maintained in spare time and comes with **no warranty and no guaranteed support**. Issues and pull requests are handled on a best-effort basis. Use it at your own risk.

## License

[MIT](LICENSE) © 2026 Tommaso Rossi. Provided "as is", without warranty of any kind.
