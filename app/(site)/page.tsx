import type { Metadata } from 'next';
import Link from 'next/link';
import BrandMark from '../components/BrandMark';
import RegistrationMark from '../components/RegistrationMark';
import InstalledAppRedirect from '../components/site/InstalledAppRedirect';
import MediaSlot from '../components/site/MediaSlot';
import Plates from '../components/site/Plates';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.description },
};

/* ── Content ──────────────────────────────────────────────────────────────
 * Kept as data so the copy can be edited without reading the markup.     */

const MODES = [
  {
    key: 'split',
    media: SITE.media.split,
    name: 'Split',
    body: 'Drag a divider across both layers. Edges and alignment jump out at the seam.',
  },
  {
    key: 'overlay',
    media: SITE.media.overlay,
    name: 'Overlay',
    body: 'Stack them with difference blending. A 1px offset or a wrong hex lights up.',
  },
  {
    key: 'tap',
    media: SITE.media.tap,
    name: 'Tap',
    body: 'Flip between design and build. Changed copy, icons and spacing flicker.',
  },
  {
    key: 'side',
    media: SITE.media.sideBySide,
    name: 'Side by side',
    body: 'Two columns with synced scroll, for long pages and vertical rhythm.',
  },
] as const;

const LEVELS = [
  {
    step: '01',
    name: 'Drag & drop',
    body: 'Drop a Figma export and a screenshot. Works in any browser, nothing to set up.',
    needs: 'Nothing',
  },
  {
    step: '02',
    name: 'Figma API',
    body: 'Paste a frame link and the design is rendered at 2x for every viewport.',
    needs: 'A Figma personal access token',
  },
  {
    step: '03',
    name: 'Fully automatic',
    body: 'Run it locally and Playwright captures the site at each exact width, localhost and logged-in pages included.',
    needs: 'The app on your machine',
  },
];

const AUDIENCES = [
  {
    who: 'For developers',
    points: [
      'Check your branch on localhost before it ships',
      'Capture 375 / 768 / 1440 px full-page in one key',
      'Open a tester’s ZIP exactly as they left it',
    ],
  },
  {
    who: 'For QA & designers',
    points: [
      'One tool instead of Figma + browser + markup + chat',
      'A diff map and pixel offsets instead of “looks a bit off”',
      'Guides, pen and notes, shared as a single ZIP',
    ],
  },
];

const RUN_LOCALLY = `git clone ${SITE.githubUrl}.git
cd pixel-perfect
npm install
npm run dev   # → http://localhost:7654/app`;

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function ButtonLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const external = href.startsWith('http');
  const className = primary
    ? 'rounded bg-press-violet px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-press-violet/85'
    : 'rounded border border-ink-700 px-4 py-2.5 text-sm font-semibold text-ink-100 transition-colors hover:border-ink-500 hover:bg-ink-900';
  return external ? (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-3 font-mono text-xs tracking-[0.18em] text-press-violet uppercase">
        {kicker}
      </p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-100 sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-ink-void text-ink-200">
      {/* First, so an installed app launching here leaves before any paint */}
      <InstalledAppRedirect />
      <div className="press-bar" aria-hidden="true" />

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={28} className="text-ink-300" />
          <span className="font-display text-sm font-extrabold tracking-[0.16em] text-ink-100 uppercase">
            {SITE.name}
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a
            href="#modes"
            className="hidden text-ink-400 hover:text-ink-100 sm:inline"
          >
            Features
          </a>
          <a
            href="#run"
            className="hidden text-ink-400 hover:text-ink-100 sm:inline"
          >
            Self-host
          </a>
          <a
            href={SITE.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 hover:text-ink-100"
          >
            GitHub
          </a>
          <Link
            href="/app"
            className="font-semibold text-press-violet hover:text-ink-100"
          >
            Open app →
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink-800 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-ink-400 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-press-cyan" />
              Open source design QA
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-ink-100 sm:text-6xl">
              Your site on top of its Figma design.{' '}
              <span className="text-press-magenta">See every pixel</span>{' '}
              <span className="text-press-cyan">that doesn’t match.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-400">
              {SITE.description}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/demo" primary>
                Try the live demo
              </ButtonLink>
              <ButtonLink href="/app">Start with your own design</ButtonLink>
              <ButtonLink href={SITE.githubUrl}>★ Star on GitHub</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              No sign-up. Your projects stay in your browser.
            </p>
          </div>

          <MediaSlot
            media={SITE.media.hero}
            label="Pixel Perfect finding the differences between a site and its Figma design"
            className="mt-16 aspect-video"
            fallback={<Plates mode="overlay" />}
          />
          {SITE.youtubeUrl ? (
            <p className="mt-3 text-center text-sm">
              <a
                href={SITE.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-press-violet hover:text-ink-100"
              >
                Watch the full walkthrough →
              </a>
            </p>
          ) : null}
        </section>

        {/* Why */}
        <section className="border-y border-ink-850 bg-ink-950">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr]">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-100">
              Design review shouldn’t take four tools and a ruler.
            </h2>
            <p className="text-base leading-relaxed text-ink-400">
              Figma in one window, the browser in another, resized by hand.
              Screenshots marked up somewhere else, pasted into a chat, argued
              about. Pixel Perfect keeps the whole loop in one place: get both
              layers, compare them, measure, annotate, and hand over the result
              as a single file.
            </p>
          </div>
        </section>

        {/* Modes */}
        <section
          id="modes"
          className="mx-auto max-w-6xl scroll-mt-8 px-4 py-24 sm:px-6"
        >
          <SectionTitle
            kicker="Four ways to compare"
            title="Each mode catches a different kind of drift."
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {MODES.map((mode) => (
              <article key={mode.key} className="flex flex-col gap-4">
                <MediaSlot
                  media={mode.media}
                  label={`${mode.name} comparison mode`}
                  className="aspect-[16/10]"
                  fallback={<Plates mode={mode.key} />}
                />
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-100">
                    {mode.name}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-400">
                    {mode.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Levels */}
        <section className="border-y border-ink-850 bg-ink-950">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <SectionTitle
              kicker="Start anywhere"
              title="From two dropped images to fully automatic."
            />
            <ol className="grid gap-px overflow-hidden rounded-md border border-ink-800 bg-ink-800 md:grid-cols-3">
              {LEVELS.map((level) => (
                <li
                  key={level.step}
                  className="flex flex-col gap-3 bg-ink-950 p-6"
                >
                  <span className="font-mono text-xs text-press-violet">
                    {level.step}
                  </span>
                  <h3 className="font-display text-lg font-bold text-ink-100">
                    {level.name}
                  </h3>
                  <p className="flex-1 text-sm leading-relaxed text-ink-400">
                    {level.body}
                  </p>
                  <p className="font-mono text-[11px] tracking-wide text-ink-500 uppercase">
                    Needs: {level.needs}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-ink-500">
              Mix them freely: a layer you dropped and a layer the app fetched
              behave the same.
            </p>
          </div>
        </section>

        {/* Audiences */}
        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-24 sm:px-6 md:grid-cols-2">
          {AUDIENCES.map((group) => (
            <div
              key={group.who}
              className="rounded-md border border-ink-800 p-7"
            >
              <h3 className="font-display text-xl font-bold text-ink-100">
                {group.who}
              </h3>
              <ul className="mt-5 space-y-3">
                {group.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-sm leading-relaxed text-ink-300"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-press-violet" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Run locally */}
        <section
          id="run"
          className="scroll-mt-8 border-t border-ink-850 bg-ink-950"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 md:grid-cols-2 md:items-center">
            <div>
              <SectionTitle
                kicker="Self-host"
                title="Run it on your machine for automatic captures."
              />
              <p className="-mt-4 text-sm leading-relaxed text-ink-400">
                The hosted version covers drag & drop and the Figma API.
                Locally, Playwright captures every viewport for you, including
                localhost and pages behind a login. Docker and Vercel setups are
                in the README.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-ink-800 bg-ink-void p-5 font-mono text-[13px] leading-relaxed text-ink-200">
              <code>{RUN_LOCALLY}</code>
            </pre>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <RegistrationMark size={56} registered className="text-ink-600" />
          <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink-100 sm:text-4xl">
            Line them up.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/demo" primary>
              Try the live demo
            </ButtonLink>
            <ButtonLink href={SITE.githubUrl}>View on GitHub</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-850">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-500 sm:px-6">
          <span>{SITE.name} · free and open source</span>
          <a
            href={SITE.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-200"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
