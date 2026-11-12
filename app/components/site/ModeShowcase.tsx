'use client';

import { useRef, useState } from 'react';
import type { Media } from '@/lib/site';
import MediaSlot from './MediaSlot';
import Plates from './Plates';

export type ModeEntry = {
  key: 'split' | 'overlay' | 'tap' | 'side';
  name: string;
  /** Keyboard shortcut in the app. */
  shortcut: string;
  /** One line: what the mode is. */
  lead: string;
  /** What you see and what it catches, read next to the screenshot. */
  body: string;
  /** The controls that matter, as short labels. */
  controls: string[];
  media: Media;
};

const altFor = (mode: ModeEntry) =>
  `${mode.name} mode in Pixel Perfect: the demo product page compared with its Figma design`;

function Shot({
  mode,
  className = '',
}: {
  mode: ModeEntry;
  className?: string;
}) {
  return (
    <MediaSlot
      media={mode.media}
      label={altFor(mode)}
      className={`aspect-[16/10] ${className}`}
      // Full width of the section: 1104px at most, the viewport below that
      sizes="(min-width: 1152px) 1104px, calc(100vw - 32px)"
      fallback={<Plates mode={mode.key} />}
    />
  );
}

function Controls({ mode }: { mode: ModeEntry }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {mode.controls.map((control) => (
        <li
          key={control}
          className="rounded border border-ink-800 bg-ink-950 px-2 py-1 font-mono text-[11px] text-ink-400"
        >
          {control}
        </li>
      ))}
      <li className="rounded border border-ink-800 bg-ink-950 px-2 py-1 font-mono text-[11px] text-ink-400">
        key <span className="text-ink-100">{mode.shortcut}</span>
      </li>
    </ul>
  );
}

/**
 * The comparison modes. From `lg` up: one large screenshot at a time, picked
 * from a row of tabs, so the app is shown close to 1:1 and stays readable.
 * Below `lg`: the four modes stacked, screenshot then copy.
 */
export default function ModeShowcase({ modes }: { modes: ModeEntry[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = modes[active];

  // Arrow keys move between tabs, as the WAI-ARIA tabs pattern expects
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + modes.length) % modes.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      {/* Desktop: tabs, copy, one large screenshot */}
      <div className="hidden lg:block">
        <div
          role="tablist"
          aria-label="Comparison modes"
          onKeyDown={onKeyDown}
          className="grid grid-cols-4 gap-px overflow-hidden rounded-md border border-ink-800 bg-ink-800"
        >
          {modes.map((mode, i) => {
            const on = i === active;
            return (
              <button
                key={mode.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`mode-tab-${mode.key}`}
                aria-selected={on}
                aria-controls="mode-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={`relative flex flex-col items-start gap-1 px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-press-violet ${
                  on ? 'bg-ink-900' : 'bg-ink-950 hover:bg-ink-900/60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-0.5 transition-colors ${
                    on ? 'bg-press-violet' : 'bg-transparent'
                  }`}
                />
                <span className="flex w-full items-center justify-between">
                  <span
                    className={`font-display text-base font-bold ${
                      on ? 'text-ink-100' : 'text-ink-400'
                    }`}
                  >
                    {mode.name}
                  </span>
                  <span className="font-mono text-[11px] text-ink-500">
                    {mode.shortcut}
                  </span>
                </span>
                <span className="text-xs leading-snug text-ink-500">
                  {mode.lead}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="mode-panel"
          aria-labelledby={`mode-tab-${current.key}`}
          className="mt-8"
        >
          <div className="mb-8 grid grid-cols-[1fr_1.4fr] items-start gap-12">
            <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink-100">
              {current.lead}
            </h3>
            <div className="flex flex-col gap-4">
              <p className="text-base leading-relaxed text-ink-400">
                {current.body}
              </p>
              <Controls mode={current} />
            </div>
          </div>

          {/* All four stay mounted so switching is instant; only one shows */}
          <div className="relative">
            {modes.map((mode, i) => (
              <div
                key={mode.key}
                aria-hidden={i !== active}
                className={`transition-opacity duration-300 ${
                  i === active
                    ? 'relative opacity-100'
                    : 'pointer-events-none absolute inset-0 opacity-0'
                }`}
              >
                <Shot mode={mode} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile and tablet: stacked */}
      <div className="flex flex-col gap-14 lg:hidden">
        {modes.map((mode) => (
          <article key={mode.key} className="flex flex-col gap-4">
            <Shot mode={mode} />
            <div className="flex flex-col gap-3">
              <h3 className="font-display text-lg font-bold text-ink-100">
                {mode.name}
              </h3>
              <p className="text-sm font-medium text-ink-200">{mode.lead}</p>
              <p className="text-sm leading-relaxed text-ink-400">
                {mode.body}
              </p>
              <Controls mode={mode} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
