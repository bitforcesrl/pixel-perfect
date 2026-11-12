import type { Metadata } from 'next';
import DocsToc from '../../components/docs/DocsToc';
import TocList from '../../components/docs/TocList';
import GettingStarted from '../../components/docs/sections/GettingStarted';
import LoadingImages from '../../components/docs/sections/LoadingImages';
import Pages from '../../components/docs/sections/Pages';
import Panels from '../../components/docs/sections/Panels';
import Projects from '../../components/docs/sections/Projects';
import SelfHosting from '../../components/docs/sections/SelfHosting';
import Sharing from '../../components/docs/sections/Sharing';
import Shortcuts from '../../components/docs/sections/Shortcuts';
import Viewports from '../../components/docs/sections/Viewports';
import JsonLd from '../../components/JsonLd';
import ButtonLink from '../../components/site/ButtonLink';
import SiteFooter from '../../components/site/SiteFooter';
import SiteHeader from '../../components/site/SiteHeader';
import { DOCS_PATH, DOCS_TOC } from '@/lib/docs';
import { docsJsonLd, OPEN_GRAPH_BASE } from '@/lib/seo';
import { SITE } from '@/lib/site';

const DESCRIPTION = `How to use ${SITE.name}: projects, pages, viewports, every way to load the Figma and site layers, and what each panel does.`;

export const metadata: Metadata = {
  title: 'Docs',
  description: DESCRIPTION,
  alternates: { canonical: DOCS_PATH },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: DOCS_PATH,
    title: `${SITE.name} docs`,
    description: DESCRIPTION,
  },
};

/**
 * The user documentation: one page, so search-in-page finds everything and
 * the app's `?` links can point straight at a heading.
 *
 * Fully static: the only script is the sidebar's section tracking.
 */
export default function DocsPage() {
  return (
    // `data-docs` turns on smooth anchor scrolling for this page only
    <div data-docs className="min-h-dvh bg-ink-void text-ink-200">
      <div className="press-bar" aria-hidden="true" />
      <JsonLd data={docsJsonLd(DESCRIPTION)} />
      <SiteHeader current="docs" />

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-8 pb-24 sm:px-6 sm:pt-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Desktop: a sticky sidebar that follows the reading position */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto pb-8">
            <DocsToc entries={DOCS_TOC} />
          </div>
        </aside>

        <main className="min-w-0 max-w-3xl">
          <header className="mb-12">
            <p className="mb-3 font-mono text-xs tracking-[0.18em] text-press-violet uppercase">
              Documentation
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-ink-100 sm:text-5xl">
              How Pixel Perfect works.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-400">
              From an empty project to a diff you can hand over: set up pages
              and viewports, load the two layers, and compare them panel by
              panel.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/demo" primary>
                Try the live demo
              </ButtonLink>
              <ButtonLink href="/app">Open the app</ButtonLink>
            </div>
          </header>

          {/* Phones and tablets: the contents fold away above the text */}
          <details className="mb-12 rounded-md border border-ink-800 bg-ink-950 lg:hidden">
            <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] tracking-[0.16em] text-ink-400 uppercase">
              On this page
            </summary>
            <nav aria-label="Documentation" className="px-2 pb-3">
              <TocList entries={DOCS_TOC} />
            </nav>
          </details>

          <div className="flex flex-col gap-14">
            <GettingStarted />
            <Projects />
            <Pages />
            <Viewports />
            <LoadingImages />
            <Panels />
            <Sharing />
            <Shortcuts />
            <SelfHosting />
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
