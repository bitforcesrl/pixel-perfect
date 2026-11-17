# Pixel Perfect Capture — privacy policy

Last updated 17 November 2026. Published at
https://pixelperfect.fit/extension/privacy (keep both texts in step: the page
is `app/(site)/extension/privacy/page.tsx`).

## In short

Pixel Perfect Capture collects no personal data, sends nothing to us or to
anyone else, and contains no analytics or tracking. The screenshots it takes go
only to the Pixel Perfect tab that asked for them, in your own browser.

## What the extension does

When Pixel Perfect (at pixelperfect.fit, on localhost, or at an address you
add in the extension's settings) asks for a capture, the extension opens the
requested page in a window of your own browser, shows it at each viewport size,
takes full-page screenshots and hands them to that Pixel Perfect tab. The
window then closes. From the toolbar icon you can also send the address and
title of the current tab to Pixel Perfect.

## Data it handles

- **Page content.** The pages you capture are rendered with your own session
  (cookies, logins) as they would be if you opened them yourself. Their pixels
  become the screenshots; nothing else is read from them. Cookie banners and
  pop-ups are hidden in the screenshot window, never clicked.
- **Settings.** The sites you allowed to be captured, the Pixel Perfect
  address you use and any extra Pixel Perfect addresses are stored with
  `chrome.storage` in your browser. Removing the extension removes them.
- **Screenshots.** Passed from the extension to the Pixel Perfect page in the
  same browser. Pixel Perfect keeps them in that browser's storage
  (IndexedDB); they are not uploaded.

## Sharing

No data is sold, transferred or shared with third parties, used for
advertising, or used to determine creditworthiness or for lending.

## Permissions

- `debugger`: drives the capture window (viewport and phone emulation,
  full-page screenshots).
- `activeTab`: reads the address of the current tab when you click the icon.
- `storage`: keeps the settings above.
- `scripting`: connects extra Pixel Perfect addresses you add.
- Host access: limited to the Pixel Perfect addresses.

## Contact

Open an issue at https://github.com/bitforcesrl/pixel-perfect/issues. The
source code of the extension is public in the same repository.
