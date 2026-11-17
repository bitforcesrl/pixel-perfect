import type { Metadata } from 'next';
import RegistrationMark from '../components/RegistrationMark';
import JsonLd from '../components/JsonLd';
import ButtonLink from '../components/site/ButtonLink';
import InstalledAppRedirect from '../components/site/InstalledAppRedirect';
import MediaSlot from '../components/site/MediaSlot';
import ModeShowcase, { type ModeEntry } from '../components/site/ModeShowcase';
import Plates from '../components/site/Plates';
import SectionTitle from '../components/site/SectionTitle';
import SiteFooter from '../components/site/SiteFooter';
import SiteHeader from '../components/site/SiteHeader';
import {
  type FaqEntry,
  faqJsonLd,
  OPEN_GRAPH_BASE,
  softwareJsonLd,
} from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: '/',
    title: SITE.name,
    description: SITE.description,
  },
};

/* ── Content ──────────────────────────────────────────────────────────────
 * Kept as data so the copy can be edited without reading the markup.     */

const MODES: ModeEntry[] = [
  {
    key: 'split',
    media: SITE.media.split,
    name: 'Split',
    shortcut: '1',
    lead: 'Slide a seam across both layers.',
    body: 'Figma on one side of the divider, the live site on the other. Drag it over a heading, a button or the edge of a card: whatever does not line up breaks at the seam. In the demo the product title is set 20% larger than designed, and the cut shows it at once.',
    controls: ['drag the divider', 'hold Space to pan'],
  },
  {
    key: 'overlay',
    media: SITE.media.overlay,
    name: 'Overlay',
    shortcut: '2',
    lead: 'Stack them and let the drift light up.',
    body: 'The design sits on top of the screenshot. Lower the opacity to ghost it, or switch to difference blending: what matches turns black, what does not glows. A font size off by a few pixels, a block pushed down, a colour that is almost right.',
    controls: ['opacity 0–100%', 'normal / difference'],
  },
  {
    key: 'tap',
    media: SITE.media.tap,
    name: 'Tap',
    shortcut: '3',
    lead: 'Hold to flip from the build to the design.',
    body: 'You look at the live site; press and hold and Figma takes its place, release and the site is back. Your eye catches whatever jumps between the two: copy, icons, spacing, the size of a price. The fastest way to review a page top to bottom.',
    controls: ['press and hold the canvas'],
  },
  {
    key: 'side',
    media: SITE.media.sideBySide,
    name: 'Side by side',
    shortcut: '4',
    lead: 'Two columns, one scroll.',
    body: 'Design and build next to each other at any zoom, scrolling together. Made for long pages and vertical rhythm: here the title wraps onto a third line and pushes everything below it down, and the centred description is easy to spot against the original.',
    controls: ['synced scroll', 'offset shifts the lock'],
  },
];

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
    body: 'Paste a frame link and the design is rendered for every viewport, sharp on mobile and desktop alike.',
    needs: 'A Figma personal access token',
  },
  {
    step: '03',
    name: 'Fully automatic',
    body: 'The site is captured full-page at each exact width in your own Chrome, with your session. Localhost, staging and logged-in pages too.',
    needs: 'The Pixel Perfect Capture extension for Chrome',
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

/** Plain text on purpose: the same answers feed the FAQPage structured data. */
const FAQ: FaqEntry[] = [
  {
    q: 'How is this different from Figma Dev Mode or an overlay browser extension?',
    a: 'Those work well for one page at a time, in your own browser. Pixel Perfect is built for a review that has to survive the handoff: the same page at 375, 768 and 1440 px (or your own sizes), both layers captured at the right scale, guides and notes attached, and a single file the developer opens exactly as QA left it. If an extension covers your workflow, keep using it; Pixel Perfect is for teams where QA and development are different people.',
  },
  {
    q: 'Is this visual regression testing?',
    a: 'No. Visual regression tools compare a site with an earlier version of itself. Pixel Perfect compares it with the design, which is what you need before any baseline exists. The two fit together: sign off the first build against Figma here, then let a regression tool stop it from drifting.',
  },
  {
    q: 'Is “pixel-perfect” really the goal? The web is fluid.',
    a: 'Not literally, and the name is a little tongue-in-cheek. The goal is to make differences visible, so you can decide which ones are intentional. Most of what a review catches is not a single pixel: wrong padding, a font size a few pixels off, a gap that halves at tablet width. Bugs, not fluid layout.',
  },
  {
    q: 'Is my Figma token safe on the hosted version?',
    a: 'Your token is saved in your browser’s localStorage and sent with each request to the app’s own API route, which calls Figma for you; it is never stored on the server (see app/api/figma/route.ts in the repository). Use a read-only token (File content: Read-only) and revoke it when you are done, or self-host the app and keep the token in your own .env.',
  },
  {
    q: 'Why do I need a Chrome extension to capture the site?',
    a: 'A browser tab cannot take a full-page screenshot of another site at an exact viewport width: something has to drive a real browser. The free Pixel Perfect Capture extension does it in your own Chrome (or Edge, Brave, Arc): it opens the page in a small window, captures every viewport and sends the screenshots to the app. No key, no account, nothing goes through a server. You can also skip capture entirely and drop in two screenshots.',
  },
  {
    q: 'Can it capture localhost, staging servers or pages behind a login?',
    a: 'Yes. The extension captures in your own Chrome with your session, so whatever you can open there it can capture: localhost, servers on your network, a store behind its password, pages behind a login. Open the site once, sign in or enter the password, then capture. It never types passwords and never clicks cookie banners; it hides them from the screenshot instead.',
  },
  {
    q: 'Where is my data? Are there team accounts?',
    a: 'Everything stays in your browser (IndexedDB): no account, no sign-up, no project data on our servers. To share a review, export the project as a ZIP and the other person imports it. Real-time collaboration is not there yet. If you need it, say so in GitHub Discussions: that is how we decide what comes next.',
  },
  {
    q: 'What about dynamic content and font rendering?',
    a: 'They add noise: carousels, cookie banners, lazy-loaded images, animations and the different ways Figma and browsers render fonts all show up as differences. Captures wait for the page to load, you can drag the Figma layer or set a vertical offset to realign after a shifted section, and Split and Tap are less sensitive to noise than a raw difference map. Dynamic regions are still the weakest spot.',
  },
  {
    q: 'Was it built with AI?',
    a: 'Largely, yes: most of the code was written with AI coding assistants. What is ours is the problem, the product decisions and testing it on real client projects. The repository runs CI with linting, type checks, tests and a secrets scan. If you find something wrong, open an issue on GitHub.',
  },
  {
    q: 'Who maintains it? Will it be abandoned?',
    a: 'Bitforce, a web agency building custom software and Shopify stores, maintains Pixel Perfect and uses it on its own client projects, so we have every reason to keep it working. Support is best-effort, with no SLA. The license is MIT, so you can always fork it.',
  },
  {
    q: 'Is it really free? What’s the catch?',
    a: 'It is free and MIT-licensed: no paid tier, no sign-up, no email gate. Bitforce is named because Bitforce builds it, but the tool does not depend on selling you anything.',
  },
  {
    q: 'What are the limits?',
    a: 'It compares pixels, not the DOM: it shows where something is off, not which CSS property is wrong. It is a manual review tool, not a CI check, so there are no baselines or pull request status. One browser holds up to 6 projects of up to 6 pages each. Figma’s image endpoint is heavily rate-limited for View and Collab seats; a Dev or Full seat works much better.',
  },
];

const RUN_LOCALLY = `git clone ${SITE.githubUrl}.git
cd pixel-perfect
npm install
npm run dev   # → http://localhost:7654/app`;

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-ink-void text-ink-200">
      {/* First, so an installed app launching here leaves before any paint */}
      <InstalledAppRedirect />
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <div className="press-bar" aria-hidden="true" />

      <SiteHeader />

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
                Watch on YouTube →
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
          <ModeShowcase modes={MODES} />
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
                title="Run it on your own machine."
              />
              <p className="-mt-4 text-sm leading-relaxed text-ink-400">
                A copy on your machine or server does everything the hosted
                version does: drag & drop, the Figma API and automatic captures
                through the Chrome extension. The Figma token can be set once
                for everyone. Docker setup is in the README.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-ink-800 bg-ink-void p-5 font-mono text-[13px] leading-relaxed text-ink-200">
              <code>{RUN_LOCALLY}</code>
            </pre>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="mx-auto max-w-6xl scroll-mt-8 px-4 py-24 sm:px-6"
        >
          <SectionTitle kicker="FAQ" title="Questions we get asked." />
          <div className="divide-y divide-ink-850 border-y border-ink-850">
            {FAQ.map((entry) => (
              <details key={entry.q} className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left font-display text-base font-bold text-ink-100 marker:hidden hover:text-press-cyan sm:text-lg [&::-webkit-details-marker]:hidden">
                  {entry.q}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-press-violet transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-3xl pb-6 text-sm leading-relaxed text-ink-400">
                  {entry.a}
                </p>
              </details>
            ))}
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

      <SiteFooter />
    </div>
  );
}
