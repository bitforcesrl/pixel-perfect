"use client";

import type { ReactNode } from "react";

export interface CollapsibleSectionProps {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const isOpen =
    controlledOpen !== undefined
      ? controlledOpen
      : // uncontrolled fallback — the caller manages state externally
        defaultOpen;

  const handleToggle = () => {
    onOpenChange?.(!isOpen);
  };

  return (
    <section className="rounded-lg border border-ink-800 bg-ink-900/60">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-wider text-ink-500 uppercase">
            {title}
          </span>
          <span className="text-[11px] text-ink-400">{summary}</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-ink-800 p-3">
          {children}
        </div>
      )}
    </section>
  );
}