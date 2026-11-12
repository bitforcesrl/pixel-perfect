import { DocSection, DocSubsection } from '../DocSection';
import Figure, { WindowShot } from '../Figure';
import {
  Availability,
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

const FIGMA_TOKEN_HELP =
  'https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens';
const BROWSERLESS_SITE = 'https://www.browserless.io/';

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
              1.75x). The Capture menu shows the scale for each viewport.
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

      <DocSubsection id={DOCS.browserless} title="Cloud capture (Browserless)">
        <P>
          The app screenshots the page&apos;s{' '}
          <DocLink to={DOCS.pageFields}>Capture URL</DocLink> in a browser
          hosted by <ExtLink href={BROWSERLESS_SITE}>Browserless</ExtLink>,
          full-page, at each viewport&apos;s exact width. It works for any
          public address, including password-protected storefronts (see{' '}
          <DocLink to={DOCS.pageFields}>Site password</DocLink>).
        </P>
        <Bullets>
          {[
            <>
              <strong>Cloud</strong> on the Site row of the Layers panel (
              <Kbd>⇧</Kbd> <Kbd>C</Kbd>) captures the viewport on screen;{' '}
              <Menu path={['Capture', 'Capture all enabled viewports']} />{' '}
              captures every enabled viewport.
            </>,
            <>
              Cookie banners and pop-ups are dismissed and the page is scrolled
              once so lazy images load.
            </>,
            <>
              While it runs, a progress sheet locks the app so results land on
              the right page; <strong>Stop</strong> cancels what is left.
            </>,
            <>
              The free Browserless plan allows one session of 60 seconds at a
              time, so viewports are captured one after the other.
            </>,
          ]}
        </Bullets>
        <WindowShot
          name="capture-progress"
          alt="The capture progress sheet listing Mobile, Tablet and Desktop as capturing, with a Stop button."
          caption="The progress sheet, one row per viewport."
        />
      </DocSubsection>

      <DocSubsection id={DOCS.browserlessKey} title="Get a Browserless key">
        <WithAside
          aside={
            <Figure
              src="/docs/browserless-key.webp"
              width={1152}
              height={651}
              displayWidth={400}
              alt="The Browserless key dialog with instructions and an API token field."
              caption="Capture ▸ Browserless key…"
            />
          }
        >
          <Steps>
            {[
              <>
                Create a free account at{' '}
                <ExtLink href={BROWSERLESS_SITE}>browserless.io</ExtLink>.
              </>,
              <>
                Copy the <strong>API token</strong> from your account dashboard.
              </>,
              <>
                In Pixel Perfect open{' '}
                <Menu path={['Capture', 'Browserless key…']} />, paste it and
                press <strong>Save key</strong>. The dialog also opens by itself
                on your first cloud capture.
              </>,
            ]}
          </Steps>
          <P>
            The key is saved in this browser with the app&apos;s data and sent
            with each capture, never stored on a server.{' '}
            <Menu path={['File', 'Reset everything…']} /> or clearing site data
            removes it.
          </P>
        </WithAside>
        <Note>
          <strong>Self-hosted:</strong> set <Code>BROWSERLESS_TOKEN</Code> on
          the server and nobody is asked for a key. See{' '}
          <DocLink to={DOCS.selfHosting}>Self-hosting</DocLink> for region,
          proxy and session settings.
        </Note>
      </DocSubsection>

      <DocSubsection
        id={DOCS.localCapture}
        title="Local capture"
        badge={<Availability only="self-hosted" />}
      >
        <P>
          When the app runs on your machine and is opened at{' '}
          <Code>localhost</Code>, a <strong>Local</strong> button joins Cloud:
          the capture runs in a Firefox on your computer, no key needed.
        </P>
        <Bullets>
          {[
            <>
              <strong>Local</strong> (<Kbd>⇧</Kbd> <Kbd>L</Kbd>) captures the
              viewport on screen,{' '}
              <Menu path={['Capture', 'Capture all on this machine']} /> every
              enabled one. Here <strong>All</strong> in the Layers panel uses
              the local browser.
            </>,
            <>
              It reaches what a remote browser cannot: <Code>localhost</Code>{' '}
              addresses, and pages behind a{' '}
              <DocLink to={DOCS.pageFields}>Browser login</DocLink>.
            </>,
            <>
              Screenshots are taken at the same scale as the Figma export (2x on
              mobile), so both layers are equally sharp.
            </>,
            <>
              Install Firefox once with <Code>npm run playwright:install</Code>.
              The Docker image already includes it.
            </>,
          ]}
        </Bullets>
        <Note>
          A cloud capture that cannot work — a <Code>localhost</Code> address, a
          site that blocks Browserless — is retried on the local browser
          automatically.
        </Note>
      </DocSubsection>
    </DocSection>
  );
}
