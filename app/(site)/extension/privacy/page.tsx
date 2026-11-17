import type { Metadata } from 'next';
import SiteFooter from '../../../components/site/SiteFooter';
import SiteHeader from '../../../components/site/SiteHeader';
import { OPEN_GRAPH_BASE } from '@/lib/seo';
import { SITE } from '@/lib/site';

const EXTENSION_PRIVACY_PATH = '/extension/privacy';

const TITLE = 'Pixel Perfect Capture privacy policy';
const DESCRIPTION =
  'What the Pixel Perfect Capture Chrome extension does with your data: nothing leaves your browser except the screenshots it hands to your own Pixel Perfect tab.';
const UPDATED = '17 November 2026';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: EXTENSION_PRIVACY_PATH },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: EXTENSION_PRIVACY_PATH,
    title: TITLE,
    description: DESCRIPTION,
  },
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 font-display text-xl font-bold text-ink-100">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-ink-300">{children}</p>;
}

/**
 * The privacy policy the Chrome Web Store listing links to. Kept in step with
 * `extension/store/privacy-policy.md`, the same text for the store dashboard.
 */
export default function ExtensionPrivacyPage() {
  return (
    <div className="min-h-dvh bg-ink-void text-ink-200">
      <div className="press-bar" aria-hidden="true" />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-24 sm:px-6 sm:pt-14">
        <p className="mb-3 font-mono text-xs tracking-[0.18em] text-press-violet uppercase">
          Chrome extension
        </p>
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-ink-100">
          Pixel Perfect Capture privacy policy
        </h1>
        <p className="mt-4 text-sm text-ink-500">Last updated {UPDATED}</p>

        <H2>In short</H2>
        <P>
          Pixel Perfect Capture collects no personal data, sends nothing to us
          or to anyone else, and contains no analytics or tracking. The
          screenshots it takes go only to the {SITE.name} tab that asked for
          them, in your own browser.
        </P>

        <H2>What the extension does</H2>
        <P>
          When {SITE.name} (at pixelperfect.fit, on localhost, or at an address
          you add in the extension&apos;s settings) asks for a capture, the
          extension opens the requested page in a window of your own browser,
          shows it at each viewport size, takes full-page screenshots and hands
          them to that {SITE.name} tab. The window then closes. From the toolbar
          icon you can also send the address and title of the current tab to{' '}
          {SITE.name}.
        </P>

        <H2>Data it handles</H2>
        <P>
          <strong>Page content.</strong> The pages you capture are rendered with
          your own session (cookies, logins) as they would be if you opened them
          yourself. Their pixels become the screenshots; nothing else is read
          from them. The extension hides cookie banners and pop-ups in the
          screenshot window and never clicks them.
        </P>
        <P>
          <strong>Settings.</strong> The sites you allowed to be captured, the
          {` ${SITE.name}`} address you use and any extra {SITE.name} addresses
          are stored with <code>chrome.storage</code> in your browser. Removing
          the extension removes them.
        </P>
        <P>
          <strong>Screenshots.</strong> Passed from the extension to the
          {` ${SITE.name}`} page in the same browser. {SITE.name} keeps them in
          that browser&apos;s storage (IndexedDB); they are not uploaded.
        </P>

        <H2>Sharing</H2>
        <P>
          No data is sold, transferred or shared with third parties, used for
          advertising, or used to determine creditworthiness or for lending.
        </P>

        <H2>Permissions</H2>
        <P>
          <code>debugger</code> drives the capture window: viewport and phone
          emulation and full-page screenshots. <code>activeTab</code> reads the
          address of the current tab when you click the icon.{' '}
          <code>storage</code> keeps the settings above. <code>scripting</code>{' '}
          connects extra {SITE.name} addresses you add. Host access is limited
          to the {SITE.name} addresses.
        </P>

        <H2>Contact</H2>
        <P>
          Questions or concerns: open an issue at{' '}
          <a
            href={`${SITE.githubUrl}/issues`}
            className="text-press-violet underline underline-offset-2"
          >
            {SITE.githubUrl.replace('https://', '')}/issues
          </a>
          . The source code of the extension is public in the same repository.
        </P>
      </main>
      <SiteFooter />
    </div>
  );
}
