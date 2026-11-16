import Link from 'next/link';
import BrandMark from '../BrandMark';
import GitHubStarBadge from './GitHubStarBadge';
import { DOCS_PATH } from '@/lib/docs';
import { SITE } from '@/lib/site';

const NAV_LINK = 'text-ink-400 hover:text-ink-100';

/**
 * The public site's top bar, shared by the landing page and the docs.
 *
 * The landing sections are linked as `/#…` so they work from any page; on the
 * landing itself the browser treats them as in-page jumps.
 *
 * It sticks to the top while the page scrolls. Its height is
 * `--site-header-h` (globals.css), which also offsets anchor jumps and the
 * docs' sticky columns so nothing lands underneath it.
 */
export default function SiteHeader({
  current,
}: {
  /** The page being shown, so its own link reads as the current one */
  current?: 'docs';
}) {
  return (
    <div
      data-site-header
      className="sticky top-0 z-30 border-b border-ink-850 bg-ink-void/85 backdrop-blur-md"
    >
      <header className="mx-auto flex h-(--site-header-h) max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark size={28} className="text-ink-300" />
          <span className="font-display text-sm font-extrabold tracking-[0.16em] text-ink-100 uppercase">
            {SITE.name}
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/#modes" className={`hidden md:inline ${NAV_LINK}`}>
            Features
          </Link>
          <Link href="/#run" className={`hidden md:inline ${NAV_LINK}`}>
            Self-host
          </Link>
          <Link href="/#faq" className={`hidden md:inline ${NAV_LINK}`}>
            FAQ
          </Link>
          <Link
            href={DOCS_PATH}
            aria-current={current === 'docs' ? 'page' : undefined}
            className={current === 'docs' ? 'text-ink-100' : NAV_LINK}
          >
            Docs
          </Link>
          {/* On a phone the bar keeps Docs and the app; GitHub is in the footer */}
          <GitHubStarBadge className="hidden sm:inline-flex" />
          <Link
            href="/app"
            className="font-semibold text-press-violet hover:text-ink-100"
          >
            Open app →
          </Link>
        </nav>
      </header>
    </div>
  );
}
