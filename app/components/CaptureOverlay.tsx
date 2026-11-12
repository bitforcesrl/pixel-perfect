'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface CaptureOverlayProps {
  /** A capture or a Figma export is running. */
  open: boolean;
  /** What is running, in a few words ("Capturing Mobile, Desktop"). */
  title: string;
  /** Stop the run: what is in flight is abandoned, what is done stays. */
  onStop: () => void;
  /** The per-viewport progress shown while waiting. */
  children: ReactNode;
}

/** The portal target only exists in the browser. */
const subscribeNothing = () => () => {};

/**
 * A full-window sheet that blocks the app while captures or Figma exports run.
 *
 * Runs write into the page they started on, viewport by viewport; switching
 * page or project, editing viewports or starting another run underneath one
 * would land results in the wrong place. Rather than guard every one of those
 * paths, nothing is reachable until the run ends: the overlay swallows
 * pointer, drag and keyboard input (the workspace behind it is also made
 * `inert` by its owner), and closing or reloading the tab asks first.
 *
 * The one way out is Stop — a hung network must never lock the app.
 */
export default function CaptureOverlay({
  open,
  title,
  onStop,
  children,
}: CaptureOverlayProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const stopRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus lands on Stop, the only control: keys typed now go nowhere else
    stopRef.current?.focus();

    // Capture phase on window runs before every other key listener — the
    // menu accelerators, the canvas, the dialogs — and stops them all. Tab
    // stays on Stop; Enter and Space still press it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target === stopRef.current && (e.key === 'Enter' || e.key === ' '))
        return;
      e.stopPropagation();
      // Browser chords (copy, devtools, zoom) are left alone; only the
      // app's own plain-key accelerators and focus moves are swallowed
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.key === 'Tab') stopRef.current?.focus();
    };
    // Leaving mid-run loses the results still in flight
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      // Above the app's dialogs (z-70) and toasts: nothing is reachable
      className="fixed inset-0 z-100 flex items-center justify-center bg-ink-void/85 p-4 backdrop-blur-[2px]"
      // Drops on the overlay are refused here; the window-level handler
      // already keeps the browser from opening the file
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'none';
      }}
      onDrop={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby="capture-overlay-title"
        aria-describedby="capture-overlay-note"
        className="flex max-h-[86vh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-press-cyan border-t-transparent"
          />
          <h2
            id="capture-overlay-title"
            className="truncate text-sm font-semibold text-ink-100"
          >
            {title}
          </h2>
        </div>

        <div aria-live="polite">{children}</div>

        <div className="flex items-center gap-3">
          <p
            id="capture-overlay-note"
            className="flex-1 text-[11px] leading-4 text-ink-500"
          >
            The app is locked until every viewport is done, so results land on
            the right page.
          </p>
          <button
            ref={stopRef}
            type="button"
            onClick={onStop}
            className="shrink-0 rounded border border-ink-700 px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-press-red/60 hover:text-press-red focus:border-press-violet focus:outline-none"
          >
            Stop
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
