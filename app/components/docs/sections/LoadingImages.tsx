import { DocSection, DocSubsection } from '../DocSection';
import Figure, { WindowShot } from '../Figure';
import {
  Bullets,
  Code,
  DocLink,
  ExtLink,
  Kbd,
  Layer,
  Menu,
  Note,
  P,
  Steps,
  WithAside,
} from '../Prose';
import { DOCS } from '@/lib/docs';
import { EXTENSION_STORE_URL } from '@/lib/features';

const FIGMA_TOKEN_HELP =
  'https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens';

export default function LoadingImages() {
  return (
    <DocSection
      id={DOCS.loadingImages}
      number="05"
      title="Loading images"
      lead="Each viewport needs two layers: the Figma design and a screenshot of the site. Get them by hand or let the app fetch them — mix freely, a dropped layer and a fetched one behave the same."
    >
      <DocSubsection id={DOCS.dragAndDrop} title="Drag & drop">
        <WindowShot
          name="drop-zones"
          alt="A file dragged over the canvas: the left half is outlined in magenta and labelled Figma, the right half in cyan and labelled Site."
          caption="While a file hovers the canvas, the half it would land on lights up."
        />
        <Bullets>
          {[
            <>
              Drop an image on the <strong>left half</strong> of the canvas for
              the <Layer of="figma" /> layer, on the <strong>right half</strong>{' '}
              for the <Layer of="site" /> layer. It goes to the viewport on
              screen.
            </>,
            <>
              Or drop it on a <strong>viewport tab</strong> above the canvas —
              left half Figma, right half site — to load a viewport without
              opening it.
            </>,
            <>
              The viewport you aim at always wins, whatever the image width.
              PNG, JPEG, WebP, AVIF, GIF and BMP are accepted.
            </>,
            <>
              Retina screenshots (1x to 3x) are recognised from their width. The
              Figma layer is scaled to the screenshot&apos;s width, so a 2x
              export lines up with a 1x screenshot.
            </>,
          ]}
        </Bullets>
      </DocSubsection>

      <DocSubsection id={DOCS.bulkUpload} title="Bulk upload">
        <P>
          The upload icons in the{' '}
          <DocLink to={DOCS.Layers}>Layers panel</DocLink> take several files at
          once — one for Figma exports (<Kbd>I</Kbd>), one for site screenshots.
          Each file goes to the viewport whose width it matches at{' '}
          <strong>1x or 2x</strong>: a 750 px export lands on Mobile 375, a 2880
          px one on Desktop 1440.
        </P>
        <P>
          The closest width wins; when two files match the same viewport, the
          last one is kept. To place a file on a viewport regardless of its
          width, <DocLink to={DOCS.dragAndDrop}>drop it</DocLink> instead.
        </P>
      </DocSubsection>

      <DocSubsection id={DOCS.figmaExport} title="Figma export">
        <P>
          With a <DocLink to={DOCS.figmaToken}>Figma token</DocLink> and the
          page&apos;s <DocLink to={DOCS.pageFields}>Figma frame URLs</DocLink>,
          the app renders the frames for you through the Figma API.
        </P>
        <Bullets>
          {[
            <>
              <strong>Capture</strong> on the Figma row of the Layers panel (
              <Kbd>⇧</Kbd> <Kbd>M</Kbd>) exports the viewport on screen;{' '}
              <strong>All</strong> exports every viewport that has a link. Both
              are in the <Menu path={['Capture']} /> menu too.
            </>,
            <>
              The scale follows the width: <strong>2x</strong> for mobile,{' '}
              <strong>1x</strong> from 1440 px, in between for tablet (768 px →
              1.75x) — but never below your screen&apos;s density, so on a
              Retina screen every viewport is <strong>2x</strong>. The Capture
              menu shows the scale for each viewport.
            </>,
            <>
              Frames too big for one render are exported in slices and stitched
              back together; a warning names any part that could not be split.
            </>,
          ]}
        </Bullets>
        <Note>
          <strong>Nothing is replaced by accident.</strong> Commands that
          replace a layer need <Kbd>⇧</Kbd>, and the every-viewport runs (
          <strong>All</strong>, Capture menu) have no key at all. When one of
          them would replace captures or exports already in place, the app asks
          first — save a <DocLink to={DOCS.History}>snapshot</DocLink> if you
          want to keep the current Figma version.
        </Note>
      </DocSubsection>

      <DocSubsection id={DOCS.figmaToken} title="Get a Figma token">
        <WithAside
          aside={
            <Figure
              src="/docs/figma-token.webp"
              width={1152}
              height={651}
              displayWidth={400}
              alt="The Figma token dialog with instructions and a Personal access token field."
              caption="Capture ▸ Figma token…"
            />
          }
        >
          <Steps>
            {[
              <>
                In Figma, open the account menu (top-left) ▸{' '}
                <strong>Settings</strong> ▸ <strong>Security</strong>.
              </>,
              <>
                Under <strong>Personal access tokens</strong>, choose{' '}
                <strong>Generate new token</strong>, give it a name and the{' '}
                <strong>File content: Read-only</strong> scope.
              </>,
              <>
                Copy the token (it starts with <Code>figd_</Code> and is shown
                only once).
              </>,
              <>
                In Pixel Perfect open{' '}
                <Menu path={['Capture', 'Figma token…']} />, paste it and press{' '}
                <strong>Save token</strong>. The dialog also opens by itself on
                your first export.
              </>,
            ]}
          </Steps>
          <P>
            The token is kept in this browser only and sent with each export,
            never stored on a server; clearing site data removes it. Figma
            limits image renders on View and Collab seats — use a Dev or Full
            seat. More in{' '}
            <ExtLink href={FIGMA_TOKEN_HELP}>Figma&apos;s help</ExtLink>.
          </P>
        </WithAside>
        <Note>
          <strong>Self-hosted:</strong> set <Code>FIGMA_TOKEN</Code> on the
          server and nobody is asked for a token — the menu entry disappears.
        </Note>
      </DocSubsection>

      <DocSubsection
        id={DOCS.chromeExtension}
        title="Automatic capture (Chrome extension)"
      >
        <P>
          Install the <strong>Pixel Perfect Capture</strong> extension and the
          site layer is generated for you: the page&apos;s{' '}
          <DocLink to={DOCS.pageFields}>Capture URL</DocLink> is screenshotted
          full-page, at each viewport&apos;s exact width, in your own Chrome and
          with your session. If you are logged in, past the shop password and
          done with the cookie banner, so is the capture. No key, no account,
          nothing sent to a server — and <Code>localhost</Code> or staging
          addresses work like any other.
        </P>
        <Steps>
          {[
            EXTENSION_STORE_URL ? (
              <>
                Install it from the{' '}
                <ExtLink href={EXTENSION_STORE_URL}>Chrome Web Store</ExtLink>{' '}
                (Chrome, Edge, Brave, Arc) and reload Pixel Perfect.
              </>
            ) : (
              <>
                Until it is on the Chrome Web Store, load it from the{' '}
                <Code>extension/</Code> folder of the repository: open{' '}
                <Code>chrome://extensions</Code>, turn on Developer mode, choose{' '}
                <strong>Load unpacked</strong> and pick the folder. Then reload
                Pixel Perfect.
              </>
            ),
            <>
              Open the site in Chrome once and get it ready the way a visitor
              would: log in, enter the password, answer the cookie banner.
            </>,
            <>
              In Pixel Perfect press <strong>Chrome</strong> on the Site row of
              the <DocLink to={DOCS.Layers}>Layers panel</DocLink> (<Kbd>⇧</Kbd>{' '}
              <Kbd>C</Kbd>) for the viewport on screen, or <strong>All</strong>{' '}
              / <Menu path={['Capture', 'Capture all enabled viewports']} /> for
              every enabled viewport.
            </>,
          ]}
        </Steps>
        <Bullets>
          {[
            <>
              The <strong>Chrome</strong> and <strong>All</strong> buttons are
              always there. Without the extension they open a dialog with the
              link to install it; the status bar, bottom right, says which
              extension version is answering, or <em>no extension</em>.
            </>,
            <>
              The first capture of a site asks you to allow it, once per site.
              Allowed sites are listed, and can be removed, in the
              extension&apos;s settings.
            </>,
            <>
              The page opens in a small window, is captured at each viewport — a
              real phone layout below 768 px, at the same scale as the Figma
              export (2x on mobile, 1x from 1440 px, 2x everywhere on a Retina
              screen) — and the window closes by itself. Chrome shows a
              &ldquo;started debugging this browser&rdquo; bar meanwhile: that
              is the extension at work; cancelling it stops the capture.
            </>,
            <>
              Lazy images are loaded before the shot. Cookie banners and pop-ups
              are hidden from the screenshot, never clicked: your choices on the
              site stay as they were.
            </>,
            <>
              A site still behind its password is reported, not captured: open
              it in Chrome, enter the password, and capture again. The extension
              never types passwords.
            </>,
            <>
              While it runs, a progress sheet locks the app so results land on
              the right page; <strong>Stop</strong> cancels what is left.
            </>,
            <>
              From any site, the extension&apos;s icon ▸{' '}
              <strong>Open in Pixel Perfect</strong> opens the page that
              compares it — or creates one — and captures it.
            </>,
          ]}
        </Bullets>
        <WindowShot
          name="capture-progress"
          alt="The capture progress sheet listing Mobile, Tablet and Desktop as capturing, with a Stop button."
          caption="The progress sheet, one row per viewport."
        />
        <Note>
          <strong>No extension, no problem:</strong> screenshots taken any other
          way can always be <DocLink to={DOCS.dragAndDrop}>dropped</DocLink> or{' '}
          <DocLink to={DOCS.bulkUpload}>uploaded</DocLink> instead.
        </Note>
      </DocSubsection>
    </DocSection>
  );
}
