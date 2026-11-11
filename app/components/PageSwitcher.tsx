'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_NAME_LENGTH, type Page } from '@/lib/projects';

export interface PageSwitcherProps {
  projectName: string;
  pages: Page[];
  activeId: string;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Opens the pages gallery — where URLs, new pages and deletes live. */
  onManage: () => void;
}

/**
 * The window title, made operable.
 *
 * The title bar already said which page you were on; this lets you leave from
 * it. The name is the control: click it for the project's other pages, or the
 * pencil to rename in place. Anything heavier — a page's URL, a new page,
 * deleting one — is the gallery behind "Manage pages…", so this stays a
 * one-click switch rather than a second gallery in a popover.
 */
export default function PageSwitcher({
  projectName,
  pages,
  activeId,
  onSelect,
  onRename,
  onManage,
}: PageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const active = pages.find((page) => page.id === activeId) ?? pages[0];

  // A click outside puts the popover away, the way the menus behave
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const startRename = () => {
    setDraft(active.name);
    setRenaming(true);
    setOpen(false);
  };

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== active.name)
      onRename(active.id, trimmed);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-ink-800 bg-ink-850 py-1 pr-1 pl-2">
        <span className="shrink-0 font-display text-[10px] font-bold tracking-[0.12em] text-press-cyan uppercase">
          {projectName}
        </span>
        <span className="text-ink-700" aria-hidden="true">
          /
        </span>
        <input
          type="text"
          value={draft}
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          aria-label="Page name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming(false);
          }}
          className="w-44 rounded border border-press-violet bg-ink-900 px-1.5 py-0.5 text-[12px] font-semibold text-ink-100 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`relative flex items-center gap-0.5 rounded-md border py-0.5 pr-0.5 pl-0.5 transition-colors ${
        open
          ? 'border-press-violet/50 bg-press-violet/10'
          : 'border-ink-800 bg-ink-850/70 hover:border-ink-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((on) => !on)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch page"
        className="flex max-w-full items-center gap-2 rounded px-1.5 py-0.5"
      >
        {/* Project first, in press cyan — the book you're in. Then the page,
            in full contrast: the one line that says where you are. */}
        <span className="shrink-0 font-display text-[10px] font-bold tracking-[0.12em] text-press-cyan uppercase">
          {projectName}
        </span>
        <span className="text-ink-700" aria-hidden="true">
          /
        </span>
        <span className="truncate text-[12px] font-semibold text-ink-100">
          {active.name}
        </span>
        <svg
          className={`h-2.5 w-2.5 shrink-0 transition-colors ${
            open ? 'text-press-violet' : 'text-ink-500'
          }`}
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2 4l4 5 4-5z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={startRename}
        aria-label={`Rename ${active.name}`}
        title="Rename this page"
        className="rounded p-1 text-ink-600 transition-colors hover:bg-ink-800 hover:text-press-violet"
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Pages"
          className="absolute top-full left-1/2 z-50 mt-1 max-h-[60vh] w-64 -translate-x-1/2 overflow-y-auto rounded-md border border-ink-700 bg-ink-850 p-1 shadow-2xl shadow-ink-void/60"
        >
          {pages.map((page) => {
            const current = page.id === active.id;
            return (
              <button
                key={page.id}
                type="button"
                role="option"
                aria-selected={current}
                onClick={() => {
                  setOpen(false);
                  if (!current) onSelect(page.id);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-press-violet/15"
              >
                <span
                  aria-hidden="true"
                  className={`w-2.5 shrink-0 text-center text-[11px] leading-none ${
                    current ? 'text-press-violet' : 'text-ink-700'
                  }`}
                >
                  {current ? '●' : ''}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`truncate text-[12px] ${
                      current ? 'text-press-violet' : 'text-ink-200'
                    }`}
                  >
                    {page.name}
                  </span>
                  {/* The URL this page shoots — the thing you switch by when
                      two pages are named alike */}
                  <span className="truncate font-mono text-[10px] text-ink-500">
                    {page.url.trim() === '' ? 'no URL yet' : page.url}
                  </span>
                </span>
              </button>
            );
          })}

          <div role="separator" className="my-1 h-px bg-ink-700" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-ink-200 transition-colors hover:bg-press-violet/15"
          >
            <span className="w-2.5 shrink-0" aria-hidden="true" />
            Manage pages…
            <span className="ml-auto font-mono text-[10px] text-ink-500">
              P
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
