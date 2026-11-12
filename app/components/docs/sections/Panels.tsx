import type { ReactNode } from 'react';
import { DocSection, DocSubsection } from '../DocSection';
import Figure, { WindowShot } from '../Figure';
import {
  Availability,
  Bullets,
  DocLink,
  Fields,
  Kbd,
  Layer,
  Menu,
  Note,
  P,
  WithAside,
} from '../Prose';
import { DOCS } from '@/lib/docs';

/** A crop of one inspector panel, shown at its real on-screen size. */
function PanelShot({
  name,
  height,
  alt,
}: {
  name: string;
  /** Pixel height of the 2x crop (all crops are 574 px wide) */
  height: number;
  alt: string;
}) {
  return (
    <Figure
      src={`/docs/${name}.webp`}
      width={574}
      height={height}
      displayWidth={287}
      alt={alt}
    />
  );
}

/** One of the four view modes, with the landing page's screenshot of it. */
function Mode({
  shot,
  name,
  shortcut,
  children,
}: {
  /** The landing page's media name: split, overlay, tap or side */
  shot: string;
  name: string;
  shortcut: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-md border border-ink-800 bg-ink-950 p-4">
      <Figure
        src={`/media/mode-${shot}.webp`}
        srcSet={`/media/mode-${shot}-960.webp 960w, /media/mode-${shot}.webp 1600w`}
        sizes="(min-width: 768px) 400px, calc(100vw - 64px)"
        width={1600}
        height={1000}
        alt={`The ${name} view mode comparing a product page with its design.`}
      />
      <h4 className="flex items-center gap-2 font-display text-base font-bold text-ink-100">
        {name} <Kbd>{shortcut}</Kbd>
      </h4>
      <p className="text-sm leading-relaxed text-ink-400 [&_strong]:font-semibold [&_strong]:text-ink-200">
        {children}
      </p>
    </article>
  );
}

export default function Panels() {
  return (
    <DocSection
      id={DOCS.panels}
      number="06"
      title="Panels"
      lead="The inspector on the left drives the comparison. Fold a panel by its title bar; the ? at its right end opens its section here. B hides the whole inspector."
    >
      {/* ── Layers ── */}
      <DocSubsection id={DOCS.Layers} title="Layers">
        <WithAside
          aside={
            <PanelShot
              name="panel-layers"
              height={293}
              alt="The Layers panel for Tablet 768×1024: a Figma row with Capture, All, upload and delete buttons, and a Site row with Cloud, Local, All, upload and delete."
            />
          }
        >
          <P>
            The two layers of the viewport on screen, one row each, with a
            status mark: <strong>✓</strong> loaded, <strong>✗</strong> failed
            (hover it for the reason), <strong>–</strong> empty, a spinner while
            working.
          </P>
          <Fields
            items={[
              {
                name: <Layer of="figma" />,
                body: (
                  <>
                    <strong>Capture</strong> (<Kbd>⇧</Kbd> <Kbd>M</Kbd>) and{' '}
                    <strong>All</strong> export from Figma — see{' '}
                    <DocLink to={DOCS.figmaExport}>Figma export</DocLink>. The
                    upload icon (<Kbd>I</Kbd>) takes{' '}
                    <DocLink to={DOCS.bulkUpload}>several files</DocLink>, the
                    bin removes this viewport&apos;s export.
                  </>
                ),
              },
              {
                name: <Layer of="site" />,
                body: (
                  <>
                    <strong>Cloud</strong> (<Kbd>⇧</Kbd> <Kbd>C</Kbd>) captures
                    with <DocLink to={DOCS.browserless}>Browserless</DocLink>,{' '}
                    <strong>Local</strong> (<Kbd>⇧</Kbd> <Kbd>L</Kbd>) with{' '}
                    <DocLink to={DOCS.localCapture}>
                      the browser on your machine
                    </DocLink>
                    , <strong>All</strong> captures every enabled viewport. The
                    upload icon and the bin work as above. Either{' '}
                    <strong>All</strong> asks before replacing layers already in
                    place.
                  </>
                ),
              },
            ]}
          />
          <P>
            A button that cannot run says why on hover — usually a missing
            Capture URL or Figma link, set in{' '}
            <DocLink to={DOCS.pageFields}>Pages</DocLink>.
          </P>
        </WithAside>
        <Note>
          <span className="mr-2 align-middle">
            <Availability only="self-hosted" />
          </span>
          The <strong>Local</strong> button only appears when the app runs on
          your machine and is opened at <code>localhost</code>.
        </Note>
      </DocSubsection>

      {/* ── Align ── */}
      <DocSubsection id={DOCS.Align} title="Align">
        <WithAside
          aside={
            <PanelShot
              name="panel-align"
              height={870}
              alt="The Align panel: Offset Y field with nudge buttons and Align top / Align bottom, zoom controls with presets, Fit and 100% 1:1, and the Drag switch between Pan and Figma."
            />
          }
        >
          <P>
            Lines the design up with the screenshot and sets how close you look.
          </P>
          <Fields
            items={[
              {
                name: 'Offset Y',
                body: (
                  <>
                    Moves the <Layer of="figma" /> layer up or down over the
                    screenshot, in pixels. Use the field, the{' '}
                    <strong>↑10 ↑1 ↓1 ↓10</strong> buttons or the arrow keys (
                    <Kbd>↑</Kbd> <Kbd>↓</Kbd> 1 px, with <Kbd>⇧</Kbd> 10 px).{' '}
                    <strong>Align top</strong> resets it to 0,{' '}
                    <strong>Align bottom</strong> lines up the bottom edges —
                    handy when only the header differs in height. The{' '}
                    <code>px</code> unit and the canvas readout turn violet at
                    0.
                  </>
                ),
              },
              {
                name: 'Zoom',
                body: (
                  <>
                    25% to 400%: <Kbd>−</Kbd> / <Kbd>+</Kbd>, the slider, a
                    typed value or the presets. <strong>Fit</strong> (
                    <Kbd>F</Kbd>) fits the layer&apos;s width to the canvas,{' '}
                    <strong>100% · 1:1</strong> (<Kbd>0</Kbd>) shows one screen
                    pixel per captured pixel.
                  </>
                ),
              },
              {
                name: 'Drag',
                body: (
                  <>
                    <strong>Pan</strong> scrolls the canvas when you drag it;{' '}
                    <strong>Figma</strong> (<Kbd>V</Kbd>) drags the Figma layer
                    up and down instead, the quickest way to line up a section.
                  </>
                ),
              },
            ]}
          />
          <Note>
            The offset is not saved with the page: it resets on reload or page
            switch. To keep it, save a{' '}
            <DocLink to={DOCS.History}>snapshot</DocLink>.
          </Note>
        </WithAside>
      </DocSubsection>

      {/* ── View ── */}
      <DocSubsection id={DOCS.View} title="View">
        <WithAside
          aside={
            <PanelShot
              name="panel-view"
              height={482}
              alt="The View panel in Overlay mode: the four mode buttons, an Opacity slider with 0%, 50% and 100% presets, and the Blend select set to difference."
            />
          }
        >
          <P>
            Four ways to compare the two layers. Each one catches a different
            kind of drift; switch with <Kbd>1</Kbd>–<Kbd>4</Kbd>. The controls
            below the buttons change with the mode.
          </P>
          <Fields
            items={[
              {
                name: 'Opacity',
                body: (
                  <>
                    Overlay only. How solid the Figma layer is, 0–100%, with
                    presets at 0, 50 and 100%.
                  </>
                ),
              },
              {
                name: 'Blend',
                body: (
                  <>
                    Overlay only. <strong>normal</strong> stacks the layers;{' '}
                    <strong>difference</strong> turns matching pixels black so
                    anything that differs glows.
                  </>
                ),
              },
              {
                name: 'Sync scroll',
                body: (
                  <>
                    Side by side only. Scrolling one column scrolls the other;
                    the Align offset shifts where they lock.
                  </>
                ),
              },
            ]}
          />
        </WithAside>
        <div className="grid gap-4 md:grid-cols-2">
          <Mode shot="split" name="Split" shortcut="1">
            A divider cuts across both layers: <Layer of="figma" /> on the left,{' '}
            <Layer of="site" /> on the right. Drag anywhere on the canvas to
            move it; whatever does not line up breaks at the seam. Hold{' '}
            <Kbd>Space</Kbd> or <Kbd>⌥</Kbd> while dragging to pan.
          </Mode>
          <Mode shot="overlay" name="Overlay" shortcut="2">
            The design sits on top of the screenshot. Lower the{' '}
            <strong>opacity</strong> to ghost it, or set <strong>Blend</strong>{' '}
            to difference: identical pixels go black, the drift lights up.
          </Mode>
          <Mode shot="tap" name="Tap" shortcut="3">
            You see the site; <strong>press and hold</strong> the canvas and
            Figma takes its place, release and the site is back. Your eye
            catches whatever jumps.
          </Mode>
          <Mode shot="side" name="Side by side" shortcut="4">
            Design and build in two columns, scrolling together. Made for long
            pages and vertical rhythm. Wide viewports open at 50% zoom.
          </Mode>
        </div>
        <WindowShot
          name="view-difference"
          alt="Overlay mode with difference blending: matching areas are black, the misplaced title, price and description glow."
          caption="Overlay with difference blending: the build sets the title larger than the design, which pushes the rating and price down."
        />
        <P>
          To hand the result over, <Menu path={['File', 'Download diff map']} />{' '}
          (<Kbd>E</Kbd>) saves a PNG of the differences: black where the layers
          match, red where they do not.
        </P>
      </DocSubsection>

      {/* ── Tools ── */}
      <DocSubsection id={DOCS.Tools} title="Tools">
        <WithAside
          aside={
            <PanelShot
              name="panel-tools"
              height={631}
              alt="The Tools panel: + Vertical and + Horizontal guide buttons with a colour well and a guide count, the Pen switch between Off and Draw with colour and widths 1, 2, 4, 8, and Undo / Clear all."
            />
          }
        >
          <P>Guides and a pen, drawn over both layers.</P>
          <Fields
            items={[
              {
                name: 'Guides',
                body: (
                  <>
                    <strong>+ Vertical</strong> (<Kbd>G</Kbd>) and{' '}
                    <strong>+ Horizontal</strong> (<Kbd>⇧</Kbd> <Kbd>G</Kbd>)
                    drop a line in the middle of the view. Its handle shows the
                    position in px: drag it, or focus it and use the arrow keys
                    (1 px, <Kbd>⇧</Kbd> 10 px). Double-click the handle, press{' '}
                    <Kbd>Delete</Kbd> or use <strong>Remove</strong> to delete
                    it. The colour well recolours the selected guide, or sets
                    the colour of the next.
                  </>
                ),
              },
              {
                name: 'Pen',
                body: (
                  <>
                    <strong>Draw</strong> (<Kbd>D</Kbd>) to circle or mark what
                    is off; pick a colour and a width (1, 2, 4 or 8 px).{' '}
                    <strong>Undo</strong> (<Kbd>Z</Kbd>) removes the last
                    stroke, <strong>Clear all</strong> removes every guide and
                    stroke. Switch back to <strong>Off</strong> to pan and drag
                    again.
                  </>
                ),
              },
            ]}
          />
          <Note tone="warn">
            Guides and drawings are not saved: a reload or a page switch clears
            them, and they are not exported. Write findings down in{' '}
            <DocLink to={DOCS.Notes}>Notes</DocLink>.
          </Note>
        </WithAside>
        <WindowShot
          name="tools-canvas"
          alt="The canvas with a yellow vertical guide at 456 px, a horizontal guide at 322 px and a red pen ellipse around the price."
          caption="Two guides measuring the layout and a pen mark around the price."
        />
      </DocSubsection>

      {/* ── History ── */}
      <DocSubsection id={DOCS.History} title="History">
        <WithAside
          aside={
            <PanelShot
              name="panel-history"
              height={519}
              alt="The History panel with a Save current export button and two snapshots, for Mobile and Tablet, each with Load, Rename and Delete."
            />
          }
        >
          <P>
            Snapshots of the Figma layer, so you can go back to an earlier
            version of the design — before re-exporting a frame that changed,
            for instance.
          </P>
          <Bullets>
            {[
              <>
                <strong>Save current export</strong> (<Kbd>S</Kbd>) archives the
                viewport&apos;s Figma export together with its Align offset. The
                site capture is not kept: it is re-shot.
              </>,
              <>
                <strong>Load</strong> puts the export and its offset back on its
                viewport and switches to it. <strong>Rename</strong> gives it a
                label; <strong>Delete</strong> asks for a second click.
              </>,
              <>
                Snapshots belong to the page, newest first. They survive{' '}
                <Menu path={['File', 'Reset this page…']} />, go away with the
                page or project, and can travel in an{' '}
                <DocLink to={DOCS.sharing}>exported ZIP</DocLink>.
              </>,
            ]}
          </Bullets>
        </WithAside>
      </DocSubsection>

      {/* ── Notes ── */}
      <DocSubsection id={DOCS.Notes} title="Notes">
        <WithAside
          aside={
            <PanelShot
              name="panel-notes"
              height={428}
              alt="The Notes panel for the Product page with three lines of review notes."
            />
          }
        >
          <P>
            Free text for the page on screen: what is off, what to check, what
            you told the designer. One note per page, shared by all its
            viewports.
          </P>
          <Bullets>
            {[
              <>Saved automatically as you type — no button.</>,
              <>
                Travels with the project in an{' '}
                <DocLink to={DOCS.sharing}>exported ZIP</DocLink>, so the person
                you send it to reads the same findings.
              </>,
              <>
                Kept by <Menu path={['File', 'Reset this page…']} />; cleared
                only by emptying the field or by{' '}
                <Menu path={['File', 'Reset everything…']} />.
              </>,
            ]}
          </Bullets>
        </WithAside>
      </DocSubsection>
    </DocSection>
  );
}
