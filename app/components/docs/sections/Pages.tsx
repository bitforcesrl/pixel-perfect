import { DocSection, DocSubsection } from '../DocSection';
import Figure from '../Figure';
import { Code, DocLink, Fields, Kbd, Menu, P, WithAside } from '../Prose';
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
        height={1312}
        displayWidth={820}
        alt="The Pages gallery: a page card with its preview, capture URL and one Figma frame URL per viewport, next to the New page card."
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
                  empty if you only drop or upload screenshots. Needed by the{' '}
                  <DocLink to={DOCS.chromeExtension}>automatic capture</DocLink>
                  . A site behind a password or a login is captured the way you
                  left it in Chrome: open it there and sign in first.
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
      </DocSubsection>
    </DocSection>
  );
}
