import { DocSection, DocSubsection } from '../DocSection';
import Figure from '../Figure';
import {
  Availability,
  Code,
  DocLink,
  Fields,
  Kbd,
  Menu,
  Note,
  P,
  WithAside,
} from '../Prose';
import { DOCS } from '@/lib/docs';

export default function Pages() {
  return (
    <DocSection
      id={DOCS.pages}
      number="03"
      title="Pages"
      lead="A page is one URL of the site. It keeps its own captures, Figma exports, snapshots and notes, for every viewport of the project."
    >
      <WithAside
        aside={
          <Figure
            src="/docs/first-page.webp"
            width={832}
            height={687}
            displayWidth={416}
            alt="The First page dialog with a page name and a capture URL."
            caption="The first page of a new project."
          />
        }
      >
        <P>
          A new project starts with one page. Add more from{' '}
          <Menu path={['File', 'Pages…']} /> (<Kbd>P</Kbd>), or from the page
          switcher in the title bar ▸ <strong>Manage pages…</strong>. The
          switcher also jumps between pages and renames the current one.
        </P>
        <P>
          In the pages gallery every page is a card: click its preview to open
          it, and edit its fields in place — they save as you type.
        </P>
      </WithAside>

      <Figure
        src="/docs/pages-gallery.webp"
        width={1640}
        height={1556}
        displayWidth={820}
        alt="The Pages gallery: a page card with its preview, capture URL, site password, browser login button and one Figma frame URL per viewport, next to the New page card."
        caption="File ▸ Pages… — one card per page, plus a card to add a new one."
      />

      <DocSubsection id={DOCS.pageFields} title="Page fields">
        <Fields
          items={[
            {
              name: 'Capture URL',
              body: (
                <>
                  The address the site screenshots are taken from (
                  <Code>http</Code> or <Code>https</Code>). Optional: leave it
                  empty if you only drop or upload screenshots. Needed by{' '}
                  <DocLink to={DOCS.browserless}>cloud</DocLink> and{' '}
                  <DocLink to={DOCS.localCapture}>local</DocLink> captures.
                </>
              ),
            },
            {
              name: 'Site password',
              body: (
                <>
                  For sites behind a <strong>password page</strong>: a Shopify
                  storefront password, a staging gate. When the page answers
                  with a password form, the capture types it in, submits it and
                  reloads the URL. Leave it empty for public pages. It is not
                  HTTP basic auth and not a user login.
                </>
              ),
            },
            {
              name: 'Browser login',
              badge: <Availability only="self-hosted-no-docker" />,
              body: (
                <>
                  For sites that need a <strong>real login</strong> (e.g. a code
                  sent by email). <strong>Log in</strong> opens a Firefox window
                  on your machine at the page URL: sign in by hand, then press{' '}
                  <strong>Done</strong>. The session (cookies and storage) is
                  saved for that host and every local capture of it starts
                  signed in. <strong>Log in again</strong> refreshes it,{' '}
                  <strong>Forget</strong> deletes it. Needs a Capture URL.
                </>
              ),
            },
            {
              name: 'Figma frame URL',
              body: (
                <>
                  One link per enabled viewport — the Figma frame that viewport
                  is designed in. In Figma, select the frame and choose{' '}
                  <strong>Copy link to selection</strong> (right-click ▸
                  Copy/Paste as). The link must contain <Code>node-id</Code>,
                  e.g. <Code>figma.com/design/…?node-id=12-34</Code>; otherwise
                  the field turns red. These links feed the{' '}
                  <DocLink to={DOCS.figmaExport}>Figma export</DocLink>.
                </>
              ),
            },
          ]}
        />
        <Note tone="warn">
          The site password is saved with the project and travels{' '}
          <strong>in plain text</strong> inside an exported ZIP. Share exports
          only with people allowed to see it.
        </Note>
      </DocSubsection>
    </DocSection>
  );
}
