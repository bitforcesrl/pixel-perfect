'use client';

import { useEffect, useState } from 'react';
import BrowserLoginControl from './BrowserLoginControl';
import RegistrationMark from './RegistrationMark';
import { parseFigmaUrl } from '@/lib/figma';
import { MAX_NAME_LENGTH, type Page } from '@/lib/projects';
import { loadPreviews } from '@/lib/storage';
import { MAX_SITE_PASSWORD_LENGTH } from '@/lib/validation';
import type { ViewportKey, ViewportPreset } from '@/lib/viewports';

export interface PagesGalleryProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  pages: Page[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string, url: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUrlChange: (url: string, pageId: string) => void;
  onSitePasswordChange: (sitePassword: string, pageId: string) => void;
  /** The project's enabled viewports — one Figma link field each. */
  presets: ViewportPreset[];
  onFigmaUrlChange: (key: ViewportKey, url: string, pageId: string) => void;
}

const FIELD =
  'w-full rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-[11px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-press-violet';
const ACTION =
  'rounded px-1.5 py-1 text-[10px] text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100';

/**
 * Every page of the project, as the thing it last captured.
 *
 * Mounted only while open, so each opening starts from a clean form and reads
 * the thumbnails again — a capture made since the last look shows up.
 */
export default function PagesGallery(props: PagesGalleryProps) {
  if (!props.open) return null;
  return <Gallery {...props} />;
}

function Gallery({
  onClose,
  projectName,
  pages,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onUrlChange,
  onSitePasswordChange,
  presets,
  onFigmaUrlChange,
}: PagesGalleryProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  // Delete asks once, in place: the page's captures, exports and notes go too
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const ids = pages.map((page) => page.id).join(',');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadPreviews(ids.length > 0 ? ids.split(',') : []);
      if (!cancelled) setPreviews(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const create = () => {
    const trimmed = newName.trim();
    if (trimmed.length === 0) return;
    onCreate(trimmed, newUrl.trim());
    setNewName('');
    setNewUrl('');
    onClose();
  };

  const commitRename = () => {
    if (renamingId === null) return;
    const trimmed = renameText.trim();
    if (trimmed.length > 0) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-60 bg-ink-void/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pages"
        className="fixed left-1/2 top-1/2 z-70 flex max-h-[86vh] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-ink-800 px-5 py-3.5">
          <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-ink-200 uppercase">
            Pages
          </h2>
          <span className="text-[11px] text-ink-500">
            {projectName} · {pages.length}
          </span>
          <span className="h-px flex-1 bg-ink-800" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pages"
            className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-850 hover:text-ink-100"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {pages.map((page) => {
              const active = page.id === activeId;
              const renaming = renamingId === page.id;
              const confirming = confirmingId === page.id;
              const preview = previews[page.id];

              return (
                <div
                  key={page.id}
                  className={`flex flex-col overflow-hidden rounded-lg border transition-colors ${
                    active
                      ? 'border-press-violet bg-press-violet/10'
                      : 'border-ink-800 bg-ink-850/40 hover:border-ink-600'
                  }`}
                >
                  {/* The preview is the page: clicking it opens that page */}
                  <button
                    type="button"
                    onClick={() => onSelect(page.id)}
                    title={`Open ${page.name}`}
                    className="relative block aspect-[16/10] w-full overflow-hidden border-b border-ink-800 bg-ink-950"
                  >
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt=""
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-[10px] text-ink-600">
                        <RegistrationMark size={28} className="text-ink-800" />
                        nothing captured yet
                      </span>
                    )}
                    {active && (
                      <span className="absolute left-2 top-2 rounded bg-press-violet px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-ink-950 uppercase">
                        Open
                      </span>
                    )}
                  </button>

                  <div className="flex flex-col gap-1.5 p-2.5">
                    {renaming ? (
                      <input
                        type="text"
                        value={renameText}
                        autoFocus
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className={FIELD}
                      />
                    ) : (
                      <span
                        className={`truncate text-[12px] font-medium ${
                          active ? 'text-press-violet' : 'text-ink-100'
                        }`}
                        title={page.name}
                      >
                        {page.name}
                      </span>
                    )}

                    {/* The URL this page captures — set here and nowhere else,
                        for any page of the project without opening it */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium tracking-[0.12em] text-press-cyan uppercase">
                        Capture URL
                      </span>
                      <input
                        type="url"
                        value={page.url}
                        placeholder="https://example.com"
                        onChange={(e) => onUrlChange(e.target.value, page.id)}
                        className={`${FIELD} font-mono text-[10px]`}
                      />
                    </label>

                    {/* Typed into the site's password gate when a capture
                        meets one — left empty for a public page */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium tracking-[0.12em] text-press-cyan uppercase">
                        Site password
                      </span>
                      <input
                        type="password"
                        value={page.sitePassword}
                        placeholder="Only if the site asks for one"
                        autoComplete="off"
                        maxLength={MAX_SITE_PASSWORD_LENGTH}
                        onChange={(e) =>
                          onSitePasswordChange(e.target.value, page.id)
                        }
                        className={`${FIELD} font-mono text-[10px]`}
                      />
                    </label>

                    {/* A login a script cannot do (a code by email), done
                        by hand once and reused by every local capture */}
                    <BrowserLoginControl url={page.url} />

                    {/* The Figma frame each viewport is exported from — the
                        link Figma copies, one per viewport */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium tracking-[0.12em] text-press-magenta uppercase">
                        Figma frame URL
                      </span>
                      {presets.map((preset) => {
                        const value = page.figmaUrls[preset.key] ?? '';
                        const unreadable =
                          value.trim() !== '' && parseFigmaUrl(value) === null;
                        return (
                          <label
                            key={preset.key}
                            className="flex flex-col gap-0.5"
                          >
                            <span className="text-[10px] text-ink-500">
                              {preset.label} · {preset.width}
                            </span>
                            <input
                              type="url"
                              value={value}
                              placeholder="https://www.figma.com/design/…?node-id=1-2"
                              spellCheck={false}
                              onChange={(e) =>
                                onFigmaUrlChange(
                                  preset.key,
                                  e.target.value,
                                  page.id,
                                )
                              }
                              className={`${FIELD} font-mono text-[10px] ${
                                unreadable ? 'border-press-red/60' : ''
                              }`}
                            />
                            {unreadable && (
                              <span className="text-[10px] text-press-red">
                                Not a Figma frame link — copy it with a frame
                                selected
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(page.id)}
                        disabled={active}
                        className={`${ACTION} disabled:cursor-default disabled:opacity-40`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(page.id);
                          setRenameText(page.name);
                          setConfirmingId(null);
                        }}
                        className={ACTION}
                      >
                        Rename
                      </button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() =>
                          confirming
                            ? onDelete(page.id)
                            : setConfirmingId(page.id)
                        }
                        onBlur={() => setConfirmingId(null)}
                        disabled={pages.length === 1}
                        title={
                          pages.length === 1
                            ? 'The last page cannot be deleted'
                            : 'Delete this page and everything in it'
                        }
                        className={`rounded px-1.5 py-1 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          confirming
                            ? 'bg-press-red/15 text-press-red'
                            : 'text-ink-500 hover:bg-ink-800 hover:text-press-red'
                        }`}
                      >
                        {confirming ? 'Sure?' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New page — the card at the end of the grid */}
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-ink-700 bg-ink-850/20 p-3">
              <span className="text-[11px] font-medium tracking-[0.14em] text-ink-500 uppercase">
                New page
              </span>
              <input
                type="text"
                value={newName}
                maxLength={MAX_NAME_LENGTH}
                placeholder="Page name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create();
                }}
                className={FIELD}
              />
              <input
                type="url"
                value={newUrl}
                placeholder="https://example.com"
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create();
                }}
                className={`${FIELD} font-mono text-[10px]`}
              />
              <button
                type="button"
                onClick={create}
                disabled={newName.trim().length === 0}
                className="rounded border border-press-violet bg-press-violet/15 px-2.5 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add page
              </button>
              <p className="text-[10px] leading-4 text-ink-600">
                Its own URL, captures, Figma exports, snapshots and notes. The
                viewport sizes come from the project.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
