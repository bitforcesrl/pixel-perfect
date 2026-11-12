import type { DocsTocEntry } from '@/lib/docs';

/**
 * The table of contents as nested links. Dumb: which entry is current comes
 * from the caller, so the same list serves the phone menu (no highlight) and
 * the desktop sidebar (scroll-tracked).
 */
export default function TocList({
  entries,
  activeId = null,
}: {
  entries: DocsTocEntry[];
  activeId?: string | null;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <li key={entry.id}>
          <TocLink entry={entry} active={entry.id === activeId} />
          {entry.children && (
            <ul className="mt-0.5 mb-1.5 ml-3 flex flex-col gap-0.5 border-l border-ink-850 pl-3">
              {entry.children.map((child) => (
                <li key={child.id}>
                  <TocLink entry={child} active={child.id === activeId} small />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function TocLink({
  entry,
  active,
  small = false,
}: {
  entry: DocsTocEntry;
  active: boolean;
  small?: boolean;
}) {
  return (
    <a
      href={`#${entry.id}`}
      aria-current={active ? 'location' : undefined}
      className={`block rounded px-2 py-1 transition-colors ${
        small ? 'text-[13px]' : 'text-sm font-medium'
      } ${
        active
          ? 'bg-ink-900 text-press-violet'
          : small
            ? 'text-ink-500 hover:text-ink-200'
            : 'text-ink-300 hover:text-ink-100'
      }`}
    >
      {entry.title}
    </a>
  );
}
