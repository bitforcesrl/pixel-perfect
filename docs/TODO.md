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
- [ ] Optional: publish on Microsoft Edge Add-ons too
      (`extension/README.md` ▸ _Microsoft Edge Add-ons_).

## Release

- [ ] **Cut the release** after the extension branch is merged into `main`
      (and ideally after the store URL is set): bump type to decide —
      `## [Unreleased]` holds removals (Browserless, local capture, browser
      login, site password), which argues for a major (2.0.0). Follow
      _Releases_ in `AGENTS.md`.
