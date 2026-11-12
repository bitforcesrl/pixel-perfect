'use client';

import { useEffect, useState } from 'react';
import TocList from './TocList';
import type { DocsTocEntry } from '@/lib/docs';

/** Every anchor of the list, parents before their children: page order. */
function flatten(entries: DocsTocEntry[]): string[] {
  return entries.flatMap((entry) => [
    entry.id,
    ...(entry.children ? flatten(entry.children) : []),
  ]);
}

/**
 * The desktop sidebar: the table of contents with the section being read
 * highlighted.
 *
 * Tracks the headings with one IntersectionObserver: a heading counts as
 * "being read" once it crosses into the top third of the window, and the last
 * one that did stays current until another takes over. Without
 * IntersectionObserver (very old browsers) the list simply has no highlight —
 * every link still works, they are plain anchors.
 */
export default function DocsToc({ entries }: { entries: DocsTocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = flatten(entries);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    // No initial state to set by hand: on `observe` the observer reports
    // where every heading is right now, so opening the page on an anchor (a
    // `?` link from the app) highlights it at once
    const observer = new IntersectionObserver(
      (records) => {
        const entering = records
          .filter((record) => record.isIntersecting)
          .map((record) => record.target.id);
        if (entering.length > 0) {
          // Several can enter in one frame (a jump): keep the lowest on the page
          const last = ids.filter((id) => entering.includes(id)).at(-1);
          if (last) setActiveId(last);
          return;
        }
        // Scrolling back up: a heading dropping out of the band below means
        // the reader is back in the section before it
        const band = (records[0]?.rootBounds?.bottom ?? 0) + 1;
        const dropped = records.find(
          (record) => record.boundingClientRect.top > band,
        );
        if (!dropped) return;
        const index = ids.indexOf(dropped.target.id);
        setActiveId(index > 0 ? ids[index - 1] : null);
      },
      // A band across the top third of the window
      { rootMargin: '0px 0px -66% 0px', threshold: 0 },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav aria-label="Documentation">
      <p className="mb-3 px-2 font-mono text-[11px] tracking-[0.16em] text-ink-500 uppercase">
        On this page
      </p>
      <TocList entries={entries} activeId={activeId} />
    </nav>
  );
}
