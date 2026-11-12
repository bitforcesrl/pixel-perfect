import Link from 'next/link';

/**
 * The public site's call-to-action button, as a link.
 *
 * External addresses open in a new tab; internal ones go through `next/link`
 * so the move between site pages is a client-side navigation.
 */
export default function ButtonLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  /** The violet, filled variant — one per group of buttons */
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
