import type { ReactNode } from 'react';

/**
 * The small building blocks the docs are written with. All dumb and
 * server-rendered: they only give text the site's look.
 */

/** Body text. */
export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-ink-400 [&_strong]:font-semibold [&_strong]:text-ink-200">
      {children}
    </p>
  );
}

/** A key on the keyboard. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-[1.6em] rounded border border-ink-800 bg-ink-950 px-1.5 py-px text-center font-mono text-[12px] text-ink-200">
      {children}
    </kbd>
  );
}

/** A path through the menus, e.g. File ▸ Pages… */
export function Menu({ path }: { path: string[] }) {
  return (
    <span className="font-medium whitespace-nowrap text-ink-200">
      {path.join(' ▸ ')}
    </span>
  );
}

/** Inline code: a file, a value, an environment variable. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink-900 px-1 py-px font-mono text-[0.85em] text-ink-200">
      {children}
    </code>
  );
}

/** A link leaving the site — always a new tab. */
export function ExtLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-press-violet underline decoration-press-violet/40 underline-offset-2 hover:text-ink-100"
    >
      {children}
    </a>
  );
}

/** A link to another part of the docs. */
export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className="text-press-violet underline decoration-press-violet/40 underline-offset-2 hover:text-ink-100"
    >
      {children}
    </a>
  );
}

/** The two layers, named in their ink: Figma magenta, the site cyan. */
export function Layer({ of }: { of: 'figma' | 'site' }) {
  return of === 'figma' ? (
    <span className="font-semibold text-press-magenta">Figma</span>
  ) : (
    <span className="font-semibold text-press-cyan">Site</span>
  );
}

/** Numbered steps, styled like the landing page's levels. */
export function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-md border border-ink-800 bg-ink-800">
      {children.map((step, index) => (
        <li
          key={index}
          className="flex gap-4 bg-ink-950 px-5 py-4 text-[15px] leading-relaxed text-ink-300 [&_strong]:font-semibold [&_strong]:text-ink-100"
        >
          <span className="pt-0.5 font-mono text-xs text-press-violet">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** A plain bulleted list, with the site's violet dots. */
export function Bullets({ children }: { children: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {children.map((item, index) => (
        <li
          key={index}
          className="flex gap-3 text-[15px] leading-relaxed text-ink-400 [&_strong]:font-semibold [&_strong]:text-ink-200"
        >
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-press-violet" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The fields of a form or the controls of a panel: name on the left, what it
 * does on the right.
 *
 * Laid out by the width of its own column, not the window's (a container
 * query): beside a panel crop the column is narrow, so name and text stack.
 */
export function Fields({
  items,
}: {
  items: { name: ReactNode; badge?: ReactNode; body: ReactNode }[];
}) {
  return (
    <div className="@container">
      <dl className="divide-y divide-ink-850 rounded-md border border-ink-800">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 px-5 py-4 @xl:grid-cols-[9rem_minmax(0,1fr)] @xl:gap-6"
          >
            <dt className="pt-0.5 font-mono text-[11px] tracking-[0.12em] text-ink-200 uppercase">
              {item.name}
            </dt>
            <dd className="flex flex-col items-start gap-2 text-sm leading-relaxed text-ink-400 [&_strong]:font-semibold [&_strong]:text-ink-200">
              {item.badge}
              <span>{item.body}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A side note. `warn` for what can bite: data leaving the browser, loss. */
export function Note({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  const border = tone === 'warn' ? 'border-press-amber' : 'border-press-violet';
  return (
    <div
      className={`rounded-r-md border-l-2 ${border} bg-ink-950 px-5 py-4 text-sm leading-relaxed text-ink-400 [&_strong]:font-semibold [&_strong]:text-ink-200`}
    >
      {children}
    </div>
  );
}

/**
 * Where a feature works, for the few that do not work everywhere. Features
 * without a badge are available in every setup.
 */
export function Availability({
  only,
}: {
  only: 'self-hosted' | 'self-hosted-no-docker';
}) {
  const label = {
    'self-hosted': 'Self-hosted only',
    'self-hosted-no-docker': 'Self-hosted only · not in Docker',
  }[only];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-press-amber/40 bg-press-amber/10 px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.12em] whitespace-nowrap text-press-amber normal-case">
      <span
        className="h-1.5 w-1.5 rounded-full bg-press-amber"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/** Text beside a panel crop: copy on the left, the picture on the right. */
export function WithAside({
  aside,
  children,
}: {
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      <div className="md:sticky md:top-8">{aside}</div>
    </div>
  );
}
