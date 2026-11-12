import type { ReactNode } from 'react';

/**
 * Headings of the docs. Each one carries the anchor the table of contents and
 * the app's `?` links point at, plus a `#` permalink that shows on hover so a
 * section can be copied and shared.
 *
 * `scroll-mt` keeps a heading clear of the top edge when jumped to.
 */

function Permalink({ id, label }: { id: string; label: string }) {
  return (
    <a
      href={`#${id}`}
      aria-label={`Link to “${label}”`}
      className="ml-2 font-mono text-[0.7em] text-ink-700 no-underline opacity-0 transition-opacity group-hover:opacity-100 hover:text-press-violet focus-visible:opacity-100"
    >
      #
    </a>
  );
}

/** A top-level section: numbered kicker, display title, then its body. */
export function DocSection({
  id,
  number,
  title,
  lead,
  children,
}: {
  id: string;
  /** Shown as the kicker, e.g. "03" */
  number: string;
  title: string;
  /** One sentence under the title saying what the section is for */
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-ink-850 pt-14 first:border-t-0 first:pt-0"
    >
      <p className="mb-3 font-mono text-xs tracking-[0.18em] text-press-violet uppercase">
        {number}
      </p>
      <h2
        id={id}
        className="group scroll-mt-8 font-display text-2xl font-extrabold tracking-tight text-ink-100 sm:text-3xl"
      >
        {title}
        <Permalink id={id} label={title} />
      </h2>
      {lead && (
        <p className="mt-4 text-base leading-relaxed text-ink-300">{lead}</p>
      )}
      <div className="mt-8 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** A subsection, with an optional badge (e.g. availability) by its title. */
export function DocSubsection({
  id,
  title,
  badge,
  children,
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 pt-6">
      <h3
        id={id}
        className="group flex scroll-mt-8 flex-wrap items-center gap-x-3 gap-y-2 font-display text-lg font-bold text-ink-100 sm:text-xl"
      >
        <span>
          {title}
          <Permalink id={id} label={title} />
        </span>
        {badge}
      </h3>
      {children}
    </section>
  );
}
