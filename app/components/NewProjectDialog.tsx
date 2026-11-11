"use client";

import { useEffect, useState } from "react";
import { MAX_NAME_LENGTH } from "@/lib/projects";

export interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

/**
 * Asks the one thing a new project needs: what to call it.
 *
 * Mounted only while open, so each opening starts from an empty field without
 * anything having to reset it.
 */
export default function NewProjectDialog({
  open,
  onClose,
  onCreate,
}: NewProjectDialogProps) {
  if (!open) return null;
  return <Dialog onClose={onClose} onCreate={onCreate} />;
}

function Dialog({
  onClose,
  onCreate,
}: Omit<NewProjectDialogProps, "open">) {
  const [name, setName] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmed = name.trim();

  const submit = () => {
    if (trimmed.length === 0) return;
    onCreate(trimmed);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-60 bg-ink-void/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        className="fixed left-1/2 top-1/3 z-70 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-ink-700 bg-ink-900 p-5 shadow-2xl"
      >
        <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-ink-200">
          New project
        </h2>
        <p className="mt-2 text-[11px] leading-5 text-ink-500">
          Its own captures, Figma exports, snapshots and notes — nothing is
          shared with the project you are in now.
        </p>
        <input
          type="text"
          value={name}
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          placeholder="Project name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="mt-3 w-full rounded border border-ink-600 bg-ink-850 px-2.5 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-600 focus:border-press-violet"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={trimmed.length === 0}
            className="rounded border border-press-violet bg-press-violet/15 px-3 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}
