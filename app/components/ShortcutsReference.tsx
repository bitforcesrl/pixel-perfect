import type { ShortcutGroup } from '@/lib/shortcuts';

export interface ShortcutsReferenceProps {
  groups: ShortcutGroup[];
}

/**
 * The keyboard shortcuts, laid out as a grid of cards — one per group.
 *
 * Dumb component: it renders whatever groups it is given, so the catalog in
 * `lib/shortcuts.ts` stays the one place that says which keys exist.
 */
export default function ShortcutsReference({
  groups,
}: ShortcutsReferenceProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <section
          key={group.title}
          className="rounded-lg border border-ink-800 bg-ink-900 p-4"
        >
          <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-ink-200 uppercase">
            {group.title}
          </h2>
          {group.note && (
            <p className="mt-1 text-[11px] text-ink-500">{group.note}</p>
          )}
          <dl className="mt-3 flex flex-col gap-1.5">
            {group.shortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center gap-3 text-[12px]"
              >
                <dt className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key, index) => (
                    <Key key={`${key}-${index}`} label={key} />
                  ))}
                </dt>
                <dd className="text-ink-300">{shortcut.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** One key cap. Words like "drag" are gestures, not keys, so they render plain. */
function Key({ label }: { label: string }) {
  if (label === 'drag') {
    return <span className="text-[11px] text-ink-500">+ drag</span>;
  }
  return (
    <kbd className="min-w-6 rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5 text-center font-mono text-[11px] text-ink-100 shadow-[inset_0_-1px_0] shadow-ink-700">
      {label}
    </kbd>
  );
}
