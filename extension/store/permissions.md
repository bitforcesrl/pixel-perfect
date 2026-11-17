# Answers for the Privacy practices tab

Paste each answer in the matching field of the Developer Dashboard.

## Single purpose

Capture full-page screenshots of web pages at chosen viewport sizes, in the
user's own browser session, and deliver them to the Pixel Perfect design QA app
that requested them.

## Permission justifications

**debugger**
Used only on the window the extension opens for a capture. It sets the viewport
size, pixel density and phone emulation (Emulation.setDeviceMetricsOverride,
user agent, touch) so a page can be shown at 375 px like on a phone — a browser
window cannot be made that narrow — and takes full-page screenshots
(Page.captureScreenshot). The session is detached and the window closed when
the capture ends. It is never attached to the user's own tabs.

**activeTab**
When the user clicks the toolbar icon, reads the address and title of the
current tab so "Open in Pixel Perfect" can send them to the app.

**storage**
Stores the user's settings locally: the sites they allowed to be captured, the
Pixel Perfect address to open, extra Pixel Perfect addresses they added.

**scripting**
Registers the extension's bridge script on extra Pixel Perfect addresses the
user adds in the settings (self-hosted copies), after Chrome asks them to grant
that address.

**Host permissions** (`https://pixelperfect.fit/*`, `https://www.pixelperfect.fit/*`,
`http://localhost:*/*`, `http://127.0.0.1:*/*`)
The bridge script runs only on Pixel Perfect pages so the app can ask the
extension for captures and receive the screenshots. Localhost is for
developers running Pixel Perfect on their machine.

**Optional host permissions** (`https://*/*`, `http://*/*`)
Requested at runtime only for a single extra Pixel Perfect address the user
types in the settings, never for all sites.

## Remote code

No, I am not using remote code. All JavaScript is in the package; nothing is
fetched or evaluated from the network.

## Data usage

Check: **Website content** (the pages being captured are rendered to produce
the screenshots).

Certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://pixelperfect.fit/extension/privacy
