import { DocSection } from '../DocSection';
import Figure from '../Figure';
import {
  Bullets,
  Code,
  DocLink,
  Kbd,
  Menu,
  Note,
  P,
  WithAside,
} from '../Prose';
import { DOCS } from '@/lib/docs';

export default function Sharing() {
  return (
    <DocSection
      id={DOCS.sharing}
      number="07"
      title="Export & share"
      lead="Projects live in your browser. To hand one over — to a developer, a designer, another computer — export it as a ZIP."
    >
      <WithAside
        aside={
          <Figure
            src="/docs/export-project.webp"
            width={832}
            height={639}
            displayWidth={416}
            alt="The Export project dialog with the Include snapshot history checkbox and the Export button."
            caption="File ▸ Export project as ZIP…"
          />
        }
      >
        <Bullets>
          {[
            <>
              <Menu path={['File', 'Export project as ZIP…']} /> packs the
              project: pages, URLs, site passwords, notes, viewport settings,
              captures and Figma exports. Tick{' '}
              <strong>Include snapshot history</strong> to add the{' '}
              <DocLink to={DOCS.History}>snapshots</DocLink> (bigger file).
            </>,
            <>
              <Menu path={['File', 'Import project from ZIP…']} /> opens it
              exactly as it was left, as a <strong>new</strong> project: nothing
              you already have is overwritten.
            </>,
            <>
              <Menu path={['File', 'Download diff map']} /> (<Kbd>E</Kbd>) saves
              a PNG of the differences for the viewport on screen, to attach to
              a ticket.
            </>,
          ]}
        </Bullets>
        <P>
          The file is named <Code>&lt;project&gt;.pixel-perfect.zip</Code>.
        </P>
      </WithAside>
      <Note tone="warn">
        <Menu path={['File', 'Reset this page…']} /> clears the page&apos;s
        captures and exports but keeps its notes and snapshots.{' '}
        <Menu path={['File', 'Reset everything…']} /> deletes every project and
        the Browserless key from this browser, and asks you to type{' '}
        <Code>RESET ALL</Code> first. Export what you want to keep.
      </Note>
    </DocSection>
  );
}
