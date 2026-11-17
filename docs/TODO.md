# To do

Open tasks that are not tied to a single change. Tick them off (or delete
them) in the same change that does them.

## Chrome extension (Pixel Perfect Capture)

- [ ] **Publish to the Chrome Web Store.** Needs `/extension/privacy` live in
      production first (the listing links to it). Steps, texts and permission
      answers: `extension/README.md` ▸ _Publish to the Chrome Web Store_ and
      `extension/store/`.
- [ ] **Set the store URL once it is approved.** In `lib/features.ts` set
      `EXTENSION_STORE_URL` to
      `https://chromewebstore.google.com/detail/pixel-perfect-capture/<id>`.
      The install dialog, _Capture ▸ Install the Chrome extension…_ and the
      docs then link to the store by themselves.
- [ ] **Update the hand-written install steps** that still say "load it
      unpacked until it is on the Chrome Web Store": `README.md` (_Optional:
      capture the site automatically_) and `extension/README.md`.
- [ ] **Check the WebP strip capture in a real Chrome**: a tall desktop page
      on a Retina screen (comes back 2x, strips line up with no seam) and a
      page at 90% Chrome zoom (captures at 1440 px). Code:
      `extension/src/capture/capture-viewport.js`, `stitch.js`.
- [ ] Optional: publish on Microsoft Edge Add-ons too
      (`extension/README.md` ▸ _Microsoft Edge Add-ons_).
