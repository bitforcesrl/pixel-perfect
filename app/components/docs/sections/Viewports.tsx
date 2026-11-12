import { DocSection } from '../DocSection';
import Figure from '../Figure';
import { Bullets, DocLink, Kbd, Menu, Note, P } from '../Prose';
import { DOCS } from '@/lib/docs';

export default function Viewports() {
  return (
    <DocSection
      id={DOCS.viewports}
      number="04"
      title="Viewports"
      lead="The screen sizes the project is designed for. Every page gets one pair of layers per enabled viewport."
    >
      <Figure
        src="/docs/viewport-settings.webp"
        width={1152}
        height={825}
        displayWidth={576}
        alt="The Viewport settings dialog listing Mobile 375×812, Tablet 768×1024 and Desktop 1440×900, each with a checkbox, width and height fields and a remove button."
        caption="Capture ▸ Viewport settings…"
      />
      <P>
        Open <Menu path={['Capture', 'Viewport settings…']} /> or press{' '}
        <Kbd>,</Kbd>. Settings belong to the project, so all its pages share
        them. New projects start with <strong>Mobile</strong> 375×812 and{' '}
        <strong>Desktop</strong> 1440×900 enabled, and <strong>Tablet</strong>{' '}
        768×1024 available but off.
      </P>
      <Bullets>
        {[
          <>
            <strong>Enable</strong> a viewport with its checkbox: only enabled
            ones get a tab above the canvas and are captured by <em>All</em>.
          </>,
          <>
            <strong>Rename</strong> it inline, and set <strong>W</strong> and{' '}
            <strong>H</strong> between 200 and 4000 px. The width is what
            matters: captures are full-page, the height only sets the window.
          </>,
          <>
            <strong>+ Add viewport</strong> creates one 100 px wider than the
            widest. <strong>×</strong> removes one.
          </>,
          <>
            Widths also decide where{' '}
            <DocLink to={DOCS.bulkUpload}>uploaded files</DocLink> land.
          </>,
        ]}
      </Bullets>
      <Note tone="warn">
        Removing a viewport deletes its captures and Figma exports on every page
        of the project. The last enabled viewport cannot be disabled or removed.
        After changing a width, re-capture: an amber note flags captures taken
        at the old size.
      </Note>
    </DocSection>
  );
}
