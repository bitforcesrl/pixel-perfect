'use client';

import { useRef, useState } from 'react';
import {
  planDesignImport,
  pngEntries,
  type ArchivePng,
  type PlannedPage,
} from '@/lib/claude-design-import';
import { hasFiles } from '@/lib/drop';
import { toCompactBlob, toThumbnailDataUrl } from '@/lib/encode';
import { readImageSize } from '@/lib/image';
import { createPage, type Page } from '@/lib/projects';
import { saveFigma, savePreview } from '@/lib/storage';
import type { ViewportPreset } from '@/lib/viewports';
import { readZip } from '@/lib/zip';

export interface ClaudeDesignImportProps {
  pages: Page[];
  /** Every viewport of the project, disabled ones too: a title can name any. */
  presets: ViewportPreset[];
  maxPages: number;
  /**
   * The design images are stored; the pages they belong to go in the project
   * now. `updatedIds` are pages that already existed and got new images.
   */
  onImported: (newPages: Page[], updatedIds: string[]) => void;
}

type Item = ArchivePng & { width: number; height: number };

type State =
  | { phase: 'idle'; error: string | null }
  | { phase: 'reading' }
  | {
      phase: 'review';
      plan: PlannedPage<Item>[];
      ticked: boolean[];
      unreadable: string[];
    }
  | { phase: 'importing'; done: number; total: number };

const BUTTON =
  'rounded border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Pages from a Claude Design export: drop the zip that Export ▸ "All artboards
 * (.png)" saves, tick the screens to bring in, and each becomes a page with
 * its design already on the right viewport, stored as WebP. The site URLs are
 * filled in afterwards, page by page.
 */
export default function ClaudeDesignImport({
  pages,
  presets,
  maxPages,
  onImported,
}: ClaudeDesignImportProps) {
  const [state, setState] = useState<State>({ phase: 'idle', error: null });
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labels = new Map(presets.map((preset) => [preset.key, preset.label]));

  const read = async (file: File) => {
    if (!/\.zip$/i.test(file.name)) {
      setState({ phase: 'idle', error: `${file.name} is not a .zip file` });
      return;
    }
    setState({ phase: 'reading' });
    try {
      const pngs = pngEntries(await readZip(file));
      if (pngs.length === 0) {
        setState({
          phase: 'idle',
          error: `No PNG in ${file.name}. Export it from Claude Design with Export ▸ All artboards (.png).`,
        });
        return;
      }
      const items: Item[] = [];
      const unreadable: string[] = [];
      for (const png of pngs) {
        const url = URL.createObjectURL(
          new Blob([png.data], { type: 'image/png' }),
        );
        try {
          items.push({ ...png, ...(await readImageSize(url)) });
        } catch {
          unreadable.push(png.name);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const plan = planDesignImport(items, presets, pages);
      setState({
        phase: 'review',
        plan,
        ticked: plan.map(() => true),
        unreadable,
      });
    } catch (err) {
      setState({
        phase: 'idle',
        error: `Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const run = async (plan: PlannedPage<Item>[]) => {
    const total = plan.reduce((sum, page) => sum + page.shots.length, 0);
    setState({ phase: 'importing', done: 0, total });
    const newPages: Page[] = [];
    const updatedIds: string[] = [];
    const failed: string[] = [];
    let done = 0;

    // One image at a time: a 2x artboard decodes to tens of megabytes
    for (const planned of plan) {
      const page = planned.existingPageId ? null : createPage(planned.name);
      const pageId = planned.existingPageId ?? page!.id;
      let landed = false;
      for (const { key, item } of planned.shots) {
        const png = new Blob([item.data], { type: 'image/png' });
        const original = URL.createObjectURL(png);
        let src = original;
        try {
          const compact = await toCompactBlob(original);
          if (compact) src = URL.createObjectURL(compact);
          await saveFigma(pageId, key, compact ?? png, item.name);
          // A new page shows its design in the gallery until it is captured
          if (page && !landed) {
            const thumbnail = await toThumbnailDataUrl(src);
            if (thumbnail) await savePreview(pageId, thumbnail);
          }
          landed = true;
        } catch {
          failed.push(item.name);
        } finally {
          URL.revokeObjectURL(original);
          if (src !== original) URL.revokeObjectURL(src);
        }
        setState({ phase: 'importing', done: ++done, total });
      }
      if (!landed) continue;
      if (page) newPages.push(page);
      else updatedIds.push(pageId);
    }

    onImported(newPages, updatedIds);
    setState({
      phase: 'idle',
      error:
        failed.length > 0
          ? `Could not import ${failed.join(', ')}; the rest is in.`
          : null,
    });
  };

  const onDrop = (e: React.DragEvent) => {
    // The workspace swallows file drops it did not handle itself
    e.preventDefault();
    e.stopPropagation();
    setHovering(false);
    const file = e.dataTransfer.files[0];
    if (file && state.phase !== 'importing' && state.phase !== 'reading') {
      void read(file);
    }
  };

  if (state.phase === 'review') {
    const { plan, ticked, unreadable } = state;
    const chosen = plan.filter((_, i) => ticked[i]);
    const adding = chosen.filter((page) => !page.existingPageId).length;
    const free = Math.max(0, maxPages - pages.length);
    const over = adding > free;
    const toggle = (index: number) =>
      setState({
        ...state,
        ticked: ticked.map((value, i) => (i === index ? !value : value)),
      });
    return (
      <Section>
        <ul className="flex max-h-72 flex-col divide-y divide-ink-800 overflow-y-auto rounded border border-ink-800">
          {plan.map((page, index) => (
            <li key={page.name}>
              <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-ink-850">
                <input
                  type="checkbox"
                  checked={ticked[index]}
                  onChange={() => toggle(index)}
                  className="accent-press-violet"
                />
                <span
                  className="min-w-0 flex-1 truncate text-ink-100"
                  title={page.name}
                >
                  {page.name}
                </span>
                {page.shots.map(({ key }) => (
                  <span
                    key={key}
                    className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300"
                  >
                    {labels.get(key) ?? key}
                  </span>
                ))}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    page.existingPageId
                      ? 'bg-press-amber/10 text-press-amber'
                      : 'bg-press-cyan/15 text-press-cyan'
                  }`}
                >
                  {page.existingPageId ? 'Updates' : 'New'}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {unreadable.length > 0 && (
          <p className="text-[10px] text-press-red">
            Not readable, left out: {unreadable.join(', ')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[10px] ${over ? 'text-press-red' : 'text-ink-500'}`}
          >
            {adding} new {adding === 1 ? 'page' : 'pages'} · {free} free of{' '}
            {maxPages}
            {over && ' — untick some screens or delete pages first'}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setState({ phase: 'idle', error: null })}
            className={`${BUTTON} border-ink-700 text-ink-400 hover:text-ink-100`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void run(chosen)}
            disabled={chosen.length === 0 || over}
            className={`${BUTTON} border-press-violet bg-press-violet/15 text-press-violet hover:bg-press-violet/25`}
          >
            Import {chosen.length} {chosen.length === 1 ? 'screen' : 'screens'}
          </button>
        </div>
      </Section>
    );
  }

  const busy = state.phase === 'reading' || state.phase === 'importing';
  return (
    <Section>
      <div
        onDragOver={(e) => {
          if (!hasFiles(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          setHovering(true);
        }}
        onDragLeave={() => setHovering(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-14 text-center transition-colors ${
          hovering
            ? 'border-press-violet bg-press-violet/10'
            : 'border-ink-700 bg-ink-850/20'
        }`}
      >
        {state.phase === 'reading' ? (
          <p className="text-[11px] text-ink-300">Reading the export…</p>
        ) : state.phase === 'importing' ? (
          <p className="text-[11px] text-ink-300">
            Converting {state.done} / {state.total}…
          </p>
        ) : (
          <>
            <p className="text-[11px] text-ink-300">
              Drop the PNG export of a Claude Design file (.zip)
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={`${BUTTON} border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100`}
            >
              Choose file
            </button>
            <p className="text-[10px] leading-4 text-ink-600">
              In Claude Design: Export ▸ All artboards (.png). One page per
              screen, each image on the viewport its title ends with (“Home –
              Desktop”).
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void read(file);
          }}
        />
      </div>
      {state.phase === 'idle' && state.error && (
        <p className="text-[10px] text-press-red">{state.error}</p>
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Import from Claude Design"
      className="flex flex-col gap-2"
    >
      {children}
    </section>
  );
}
