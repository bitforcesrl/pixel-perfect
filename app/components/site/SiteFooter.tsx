import Link from 'next/link';
import { DOCS_PATH } from '@/lib/docs';
import { SITE } from '@/lib/site';

/** The public site's bottom line, shared by the landing page and the docs. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-ink-850">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-500 sm:px-6">
        <span>{SITE.name} · free and open source</span>
        <span className="flex items-center gap-5">
          <Link href={DOCS_PATH} className="hover:text-ink-200">
            Docs
          </Link>
          <a
            href={SITE.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-200"
          >
            GitHub
          </a>
        </span>
      </div>
    </footer>
  );
}
