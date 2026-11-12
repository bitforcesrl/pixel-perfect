import { DocSection } from '../DocSection';
import { WindowShot } from '../Figure';
import { Bullets, Code, DocLink, ExtLink, Layer, Note } from '../Prose';
import { DOCS } from '@/lib/docs';
import { SITE } from '@/lib/site';

export default function GettingStarted() {
  return (
    <DocSection
      id={DOCS.gettingStarted}
      number="01"
      title="Getting started"
      lead="Pixel Perfect lays a screenshot of your site over its Figma design, per page and per viewport, so every pixel that drifts is easy to spot."
    >
      <WindowShot
        name="app-overview"
        alt="The Pixel Perfect app: menu bar on top, the inspector panels on the left, and the canvas showing a product page split between its Figma design and the live site."
        caption="The app with the demo project open: inspector panels on the left, the viewport tabs and the canvas on the right."
      />
      <Bullets>
        {[
          <>
            Every comparison has two layers: the <Layer of="figma" /> export of
            the design (magenta) and the <Layer of="site" /> screenshot (cyan).
            They line up from the top-left corner.
          </>,
          <>
            Work is organised in <strong>projects</strong>, each with its{' '}
            <strong>pages</strong> and <strong>viewports</strong>. One page
            holds one pair of layers per viewport.
          </>,
          <>
            Everything stays in your browser (IndexedDB): no account, nothing
            stored on a server. Share a project as a ZIP — see{' '}
            <DocLink to={DOCS.sharing}>Export &amp; share</DocLink>.
          </>,
          <>
            Want to look around first? Open the{' '}
            <a
              href="/demo"
              className="text-press-violet underline decoration-press-violet/40 underline-offset-2 hover:text-ink-100"
            >
              live demo
            </a>
            : a ready-made project with all layers loaded.
          </>,
        ]}
      </Bullets>
      <Note>
        <strong>Hosted or self-hosted.</strong> The public app works for
        everyone with drag &amp; drop, the Figma API and cloud captures. Running
        it on your own machine (<Code>npm run dev</Code>, see{' '}
        <DocLink to={DOCS.selfHosting}>Self-hosting</DocLink>) adds a few
        extras: those are marked{' '}
        <span className="font-mono text-[12px] text-press-amber">
          Self-hosted only
        </span>{' '}
        below. The source is on <ExtLink href={SITE.githubUrl}>GitHub</ExtLink>.
      </Note>
    </DocSection>
  );
}
