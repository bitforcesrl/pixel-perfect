'use client';

import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A line under the title saying what this dialog is for. */
  subtitle?: string;
  /** How wide the sheet gets. Panels are narrow; galleries are wide. */
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const WIDTH: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'w-[min(24rem,calc(100vw-2rem))]',
  md: 'w-[min(34rem,calc(100vw-2rem))]',
  lg: 'w-[min(64rem,calc(100vw-2rem))]',
};

/**
 * The one dialog every menu command opens.
 *
 * It sits in the middle of the window rather than sliding in from an edge: a
 * menu command is a modal errand — you set the URL, or the viewport sizes, and
 * go back to the canvas — and a centred sheet says that where a drawer said
 * "this stays open beside your work".
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
        aria-label={title}
        className={`fixed top-1/2 left-1/2 z-70 flex max-h-[86vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-ink-700 bg-ink-900 shadow-2xl ${WIDTH[size]}`}
      >
        <div className="flex items-center gap-2 border-b border-ink-800 px-5 py-3.5">
          <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-ink-200 uppercase">
            {title}
          </h2>
          {subtitle && (
            <span className="truncate text-[11px] text-ink-500">
              {subtitle}
            </span>
          )}
          <span className="h-px flex-1 bg-ink-800" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-ink-100">
          {children}
        </div>
      </div>
    </>
  );
}
