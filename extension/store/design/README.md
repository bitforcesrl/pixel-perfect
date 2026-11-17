# Store artwork sources

The Chrome Web Store images in `extension/store/` are exported from the pages
in this folder: each page is one image at its exact store size, in the app's
palette and fonts.

| Page                    | Exports to                        | Size     |
| ----------------------- | --------------------------------- | -------- |
| `1-overview.html`       | `screenshots/1-overview.png`      | 1280×800 |
| `2-capture.html`        | `screenshots/2-capture.png`       | 1280×800 |
| `3-popup.html`          | `screenshots/3-popup.png`         | 1280×800 |
| `4-consent.html`        | `screenshots/4-consent.png`       | 1280×800 |
| `promo-440x280.html`    | `promo-440x280.png` (required)    | 440×280  |
| `marquee-1400x560.html` | `marquee-1400x560.png` (optional) | 1400×560 |

The promo tiles and the first screenshot sell Pixel Perfect as a whole, with
the app's own line from the home page ("Your site on top of its Figma
design. See every pixel that doesn't match.") and its description; the other
screenshots show what the extension adds to it. Keep that copy in step with
the home page (`app/(site)/page.tsx`, `lib/site.ts`).

- `raw/` holds what the pages are made of: app screenshots taken on the demo
  project (`app-*.webp`, 1440×900 at 2x), the demo shop's captures from
  `public/demo-project.zip` (`shop-*.webp`) and the app icon. The demo shop
  wears the Pixel Perfect logo; `design.css` covers it with a neutral
  "valdo." wordmark so the pictures do not read as "the app capturing
  itself".
- The popup and the consent window are not drawn: `3-popup.html` and
  `4-consent.html` embed the extension's real `src/ui/popup.html` and
  `src/ui/confirm.html`, so a change to those pages shows up on the next
  export.

## Export

1. Serve the extension folder (the embedded pages need `http://`, not
   `file://`):

   ```bash
   cd extension && python3 -m http.server 7700
   ```

2. Open a page in Chrome, e.g. `http://localhost:7700/store/design/1-overview.html`,
   in dark mode.
3. For the two pages that embed the extension's UI, define a stand-in for the
   `chrome` API before the page loads (DevTools ▸ Sources ▸ Snippets, or any
   tool that injects a script on new documents):

   ```js
   window.chrome = {
     runtime: {
       getManifest: () => ({ version: '1.0.0', update_url: 'store' }),
       sendMessage: async () => ({ ok: true }),
       openOptionsPage() {},
     },
     tabs: {
       query: async () => [{ url: 'https://shop.example.com/valdo-28l' }],
     },
   };
   ```

4. DevTools ▸ device toolbar: the page's size (see the table), device pixel
   ratio 2, then ⋮ ▸ **Capture screenshot**.
5. Scale the capture down to the exact size, as a 24-bit PNG without alpha
   (what the store asks for):

   ```bash
   magick capture.png -filter Lanczos -resize 1280x800! -alpha off \
     -define png:color-type=2 ../screenshots/1-overview.png
   ```

Retake `raw/app-*.webp` when the app's look changes: open `/demo` on a
production build (`npm run build && npm start`, no dev indicator) at
1440×900, 2x.
