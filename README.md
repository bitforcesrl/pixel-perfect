# Pixel Perfect

[![CI](https://github.com/bitforcesrl/pixel-perfect/actions/workflows/ci.yml/badge.svg)](https://github.com/bitforcesrl/pixel-perfect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.9-339933.svg?logo=node.js&logoColor=white)](.nvmrc)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg?logo=next.js)](https://nextjs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> Put the live site and its Figma design on top of each other, and see every pixel that doesn't match.

Pixel Perfect is a web app for **design QA**. For each page and each viewport (mobile, tablet, desktop or your own sizes) it stacks a screenshot of the website over the matching Figma frame, then gives you four ways to compare them, plus tools to align, measure, annotate and share what you find.

Start with two images dragged onto the canvas. Add a Figma token and the design frames are fetched for you. Run it locally and the site is captured for you too, with Playwright.

---

## Contents

- [Why it exists](#why-it-exists)
- [What it makes easier](#what-it-makes-easier)
- [Three ways to use it](#three-ways-to-use-it)
- [Features](#features)
- [Core concepts](#core-concepts)
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
- **No manual resizing or exporting.** One key captures the page at 375, 768 or 1440 px (or any viewport you define), full-page. Another renders the Figma frame at 2x straight from the Figma API.
- **Works on `localhost`.** Compare your branch while you build it, before it's deployed, even on pages behind a login.
- **Bug reports with full context.** A tester sends you a ZIP with captures, Figma frames, guides, drawings and notes, and you open it exactly as they left it.

### For QA testers

- **One tool for design review** instead of Figma + browser + a markup tool + chat.
- **Objective evidence.** A difference map and pixel-exact offsets replace "it looks a bit off".
- **Precise measuring.** Horizontal and vertical guides, vertical offset to the pixel, zoom down to the detail.
- **Repeatable reviews.** Each project keeps its pages, viewports, notes and a history of Figma exports, so you can re-check the same screens after every fix.
- **Nothing to install** on the hosted version: drag two images in and start comparing.

---

## Three ways to use it

| Level                         | Figma layer                 | Site layer                             | Needs                           |
| ----------------------------- | --------------------------- | -------------------------------------- | ------------------------------- |
| **1. Drag & drop** (base)     | Drop a PNG/JPEG export      | Drop a PNG/JPEG screenshot             | Nothing: works anywhere         |
| **2. Figma API**              | Fetched automatically at 2x | Drop a screenshot                      | A Figma personal access token   |
| **3. Local, fully automatic** | Fetched automatically at 2x | Captured automatically with Playwright | The app running on your machine |

You can mix them freely: a layer you drop and a layer the app fetched behave exactly the same.

---

## Features

| Area                 | What it does                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Drag & drop**      | Drop images on the canvas (left half = Figma, right half = site) or on a viewport tab, split the same way. PNG, JPEG, WebP, AVIF, GIF and BMP are accepted; a retina screenshot is recognised by its width and shown at the viewport's CSS size. |
| **Figma export**     | Renders a frame at 2x through the Figma REST API, for one viewport (`M`) or all of them (`⇧M`).                                                                                                                                                  |
| **Site capture**     | Full-page screenshots at each viewport's exact width with Playwright, when running locally.                                                                                                                                                      |
| **Projects & pages** | A project holds many pages. Each page has a URL and one Figma link per viewport. Gallery with thumbnails.                                                                                                                                        |
| **Viewports**        | Mobile, Tablet and Desktop by default. Add, rename, resize or disable them in the settings.                                                                                                                                                      |
| **Comparison modes** | **Split**, **Overlay** (opacity + `difference`, `normal`, `overlay`, `exclusion` blend modes), **Tap**, **Side by side** (synced scroll).                                                                                                        |
| **Alignment**        | Pixel vertical offset, align top/bottom, drag the Figma layer, zoom and fit.                                                                                                                                                                     |
| **Annotations**      | Vertical and horizontal guides, a pen with colors and widths, per-page text notes.                                                                                                                                                               |
| **History**          | Save Figma exports as named snapshots to compare design versions over time.                                                                                                                                                                      |
| **Sharing**          | Export/import a whole project as a ZIP: layers, guides, drawings, notes and settings.                                                                                                                                                            |
| **Diff map**         | Download the difference image to attach to a ticket.                                                                                                                                                                                             |
| **Persistence**      | Everything is kept in the browser (IndexedDB). Reload and pick up where you left off.                                                                                                                                                            |
| **Access control**   | Optional password for a public deployment.                                                                                                                                                                                                       |

## Core concepts

- **Project**: a site or feature under review.
- **Page**: a site URL plus links to its Figma frames, one per viewport. Managed under **File ▸ Pages**.
- **Viewport**: a size (width × height) at which both layers are compared.
- **Layers**: each viewport has two plates, _Figma_ (magenta) and _Site_ (cyan). The **Layers** panel shows the state of each and lets you fetch it again or remove it.

> Data lives **only in the browser you're using**. To move it to another machine or share it, use **File ▸ Export project as ZIP** and **File ▸ Import project from ZIP**.

---

## Using the hosted version

The hosted version (for example on Vercel) is for anyone without the repo: QA testers, designers, PMs. Everything happens in the browser.

### 1. Sign in

Open the deployment URL. If the instance is protected, enter the team password. The browser remembers it.

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
5. Press **Capture** on the _Figma_ row of the **Layers** panel (`M`), or **All** (`⇧M`) for every viewport.

> Figma's image-rendering endpoint is tightly rate limited for _View_ and _Collab_ seats. Use a _Dev_ or _Full_ seat.

### 5. Compare, annotate, share

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

Running the app on your own machine unlocks **fully automatic capture**. Configure each page once (URL + Figma links) and the app fetches both layers for every viewport in one go: Figma through its API, the site through a real browser driven by **Playwright**. That includes `localhost`, staging servers on your network and pages behind a login.

### Requirements

- **Node.js 20.9+** (22 recommended)
- npm

### Install

```bash
git clone https://github.com/bitforcesrl/pixel-perfect.git
cd pixel-perfect
npm install
cp .env.example .env # optional: no variable is required locally
npm run dev
```

Open **http://localhost:7654**.

Drag & drop and Figma export work right away. **Automatic site capture is optional** and needs a browser that Playwright drives; download it once (about 100 MB) only if you want it:

```bash
npm run playwright:install   # downloads Firefox for local captures
```

### Set up automatic capture

1. **Browser**: run `npm run playwright:install` once, if you haven't already.
2. **Figma token**: set `FIGMA_TOKEN` in `.env`, or paste your own token in the app (see [above](#4-optional-fetch-figma-frames-automatically)).
3. **Pages**: in **File ▸ Pages**, give each page its **Capture URL** and one **Figma frame link** per viewport.
4. **Viewports**: adjust sizes or add new ones under **Capture ▸ Viewport settings…** (`,`).

### Capture

When the app is opened from `localhost`, the _Site_ row in the **Layers** panel shows the **Local** button:

| Action                             | Button                  | Key  | Menu                                          |
| ---------------------------------- | ----------------------- | ---- | --------------------------------------------- |
| Capture the site, current viewport | **Local**               | `L`  | Capture ▸ Capture _viewport_ on this machine  |
| Capture the site, every viewport   | **All**                 | `⇧L` | Capture ▸ Capture all on this machine         |
| Export Figma, current viewport     | **Capture** (Figma row) | `M`  | Capture ▸ Export _viewport_ Figma frame at 2x |
| Export Figma, every viewport       | **All** (Figma row)     | `⇧M` | Capture ▸ Export every Figma frame at 2x      |

A site capture opens the page at the viewport's exact width, waits for it to load and saves a full-page screenshot. You can capture:

- your dev server (`http://localhost:3000` and so on);
- public or staging sites;
- sites that rate limit by IP. The request leaves from your own connection, not a datacenter.

### Pages behind a login

For sites a script can't log into (a one-time code sent by email, for example), use the **Browser login** section of the page in **File ▸ Pages**:

1. Press **Log in**. A **visible** Firefox window opens on your machine.
2. Log in as you normally would.
3. Press **Done** (or close the window). The site's cookies and storage are saved locally, per host.
4. Later captures of that site start already logged in. Use **Log in again** when the session expires.

> This only works when the app runs directly on your machine (`npm run dev` / `npm start`), not inside Docker.

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

The image ships with Firefox for captures. To capture a server running on your host, use `http://host.docker.internal:<port>` instead of `localhost`. The manual login window isn't available in Docker.

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
| `npm run playwright:install`      | Download the browser used for local captures   |
| `npm run secrets:scan`            | Scan git history for leaked secrets (gitleaks) |

---

## Configuration

Every variable is optional. See [`.env.example`](.env.example) for details.

| Variable        | Purpose                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `SITE_PASSWORD` | Protects the instance with a password. Empty means no gate (the local default). Changing it makes every browser ask again. |
| `FIGMA_TOKEN`   | A server-wide Figma token. When unset, each user enters their own.                                                         |

For a public deployment, set at least `SITE_PASSWORD`.

---

## Keyboard shortcuts

The full list is under **Help ▸ Keyboard shortcuts**. The main ones:

| Key             | Action                                     |
| --------------- | ------------------------------------------ |
| `1` `2` `3` `4` | Split / Overlay / Tap / Side by side       |
| `I`             | Open Figma exports from disk               |
| `L` / `⇧L`      | Local site capture: current viewport / all |
| `M` / `⇧M`      | Figma export: current viewport / all       |
| `+` `-` `f` `0` | Zoom in / out / fit / 100%                 |
| `G` / `⇧G`      | Vertical / horizontal guide                |
| `D` / `Z`       | Pen / undo last stroke                     |
| `S`             | Save snapshot                              |
| `E`             | Download diff map                          |
| `N` / `P`       | New project / pages                        |
| `B`             | Show/hide the inspector                    |

---

## Project structure

```text
app/
  api/            Server routes: screenshot, figma, auth, login-session
  components/     React components (Workspace is the smart container; the rest are reusable UI)
lib/              Pure logic: capture, Figma, IndexedDB storage, ZIP, diff, viewports, feature flags
scripts/          git hooks (gitleaks pre-commit)
```

Stack: **Next.js 16**, **React 19**, **Tailwind CSS 4**, **Playwright**, **Vitest**.

## Contributing

Contributions are welcome: bug reports, ideas, docs and code. Read the [contributing guide](CONTRIBUTING.md) for the setup, code style and pull request process, and run `npm run check` before opening a PR.

Looking for a place to start? Browse the issues labelled [`good first issue`](https://github.com/bitforcesrl/pixel-perfect/labels/good%20first%20issue).

## Community

- 🐛 **Bugs and feature requests**: [GitHub Issues](https://github.com/bitforcesrl/pixel-perfect/issues)
- 💬 **Questions and ideas**: [GitHub Discussions](https://github.com/bitforcesrl/pixel-perfect/discussions)
- 🔒 **Security vulnerabilities**: report them privately as described in [SECURITY.md](SECURITY.md)
- 📝 **What's new**: [CHANGELOG.md](CHANGELOG.md)

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

> Pixel Perfect is maintained in spare time and comes with **no warranty and no guaranteed support**. Issues and pull requests are handled on a best-effort basis. Use it at your own risk.

## License

[MIT](LICENSE) © 2026 Tommaso Rossi. Provided "as is", without warranty of any kind.
