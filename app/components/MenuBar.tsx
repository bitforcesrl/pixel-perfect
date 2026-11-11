'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A command. `marker` turns it into a checkbox or a radio member. */
export interface MenuCommand {
  kind?: 'item';
  label: string;
  onSelect: () => void;
  /** Printed on the right, the way a desktop menu advertises its accelerator */
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  marker?: 'check' | 'radio';
  danger?: boolean;
  title?: string;
}

export type MenuEntry =
  MenuCommand | { kind: 'separator' } | { kind: 'heading'; label: string };

export interface Menu {
  id: string;
  label: string;
  entries: MenuEntry[];
}

export interface MenuBarProps {
  menus: Menu[];
  /** Sits left of the menu titles — the mark and the wordmark */
  brand?: ReactNode;
  /** Centred like a window title: what this canvas is showing */
  title?: ReactNode;
  /** Right end of the bar. The one control that never became a menu item. */
  actions?: ReactNode;
}

function isCommand(entry: MenuEntry): entry is MenuCommand {
  return entry.kind === undefined || entry.kind === 'item';
}

/**
 * The application menu bar.
 *
 * Every command in the app is reachable from here, grouped the way a desktop
 * app groups them, so the canvas keeps no toolbar of its own. Opening one menu
 * arms the rest: with a menu open, moving across the titles switches to them
 * without a second click — the behaviour the pattern is recognised by.
 */
export default function MenuBar({
  menus,
  brand,
  title,
  actions,
}: MenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const titlesRef = useRef<HTMLDivElement>(null);

  // A click anywhere else closes the menu — the desktop contract. Anywhere
  // means anywhere: the titles and their dropdowns are the only exception, so
  // hitting Capture in this same bar puts the menu away on the way past.
  useEffect(() => {
    if (openId === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!titlesRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openId]);

  // Hand the keyboard the first item as the menu opens. Mouse users never see
  // it: the app rings on :focus-visible only.
  useEffect(() => {
    if (openId === null) return;
    dropdownRef.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
  }, [openId]);

  const focusTitle = (id: string) => {
    titlesRef.current
      ?.querySelector<HTMLButtonElement>(`[data-menu="${id}"]`)
      ?.focus();
  };

  const stepMenu = (dir: 1 | -1) => {
    const index = menus.findIndex((menu) => menu.id === openId);
    if (index === -1) return;
    const next = menus[(index + dir + menus.length) % menus.length];
    setOpenId(next.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (openId === null) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      const id = openId;
      setOpenId(null);
      focusTitle(id);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stepMenu(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(
      dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      ) ?? [],
    );
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
    items[(next + items.length) % items.length].focus();
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative z-40 flex h-9 shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-900 pr-2 pl-2.5"
    >
      {brand}

      <div ref={titlesRef} className="flex items-center" role="menubar">
        {menus.map((menu) => {
          const open = openId === menu.id;
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                data-menu={menu.id}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : menu.id)}
                // Armed: with one menu open the others open on the way past
                onMouseEnter={() => openId !== null && setOpenId(menu.id)}
                className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  open
                    ? 'bg-press-violet/15 text-press-violet'
                    : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
                }`}
              >
                {menu.label}
              </button>

              {open && (
                <div
                  ref={dropdownRef}
                  role="menu"
                  aria-label={menu.label}
                  className="absolute top-full left-0 mt-1 min-w-60 rounded-md border border-ink-700 bg-ink-850 p-1 shadow-2xl shadow-ink-void/60"
                >
                  {menu.entries.map((entry, index) => {
                    if (entry.kind === 'separator') {
                      return (
                        <div
                          key={`sep-${index}`}
                          role="separator"
                          className="my-1 h-px bg-ink-700"
                        />
                      );
                    }
                    if (entry.kind === 'heading') {
                      return (
                        <div
                          key={`head-${index}`}
                          className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase"
                        >
                          {entry.label}
                        </div>
                      );
                    }
                    if (!isCommand(entry)) return null;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        role="menuitem"
                        disabled={entry.disabled}
                        title={entry.title}
                        onClick={() => {
                          setOpenId(null);
                          entry.onSelect();
                        }}
                        className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          entry.danger
                            ? 'text-ink-200 hover:bg-press-red/15 hover:text-press-red'
                            : 'text-ink-200 hover:bg-press-violet/15 hover:text-ink-100'
                        } disabled:hover:bg-transparent disabled:hover:text-ink-200`}
                      >
                        {/* One gutter for every row, ticked or not, so the
                            labels of a group stay on the same left edge */}
                        <span
                          aria-hidden="true"
                          className={`w-2.5 shrink-0 text-center text-[11px] leading-none ${
                            entry.checked ? 'text-press-violet' : 'text-ink-700'
                          }`}
                        >
                          {entry.checked
                            ? entry.marker === 'radio'
                              ? '●'
                              : '✓'
                            : ''}
                        </span>
                        <span className="flex-1 truncate">{entry.label}</span>
                        {entry.shortcut && (
                          <span className="shrink-0 font-mono text-[10px] text-ink-500">
                            {entry.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Window title: which project and page this canvas belongs to — and,
          since the page switcher lives in it, something you can click */}
      {title && (
        <div className="absolute top-1/2 left-1/2 hidden max-w-[40%] -translate-x-1/2 -translate-y-1/2 md:block">
          {title}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </div>
  );
}
