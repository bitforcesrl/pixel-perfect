"use client";

import { useState } from "react";
import Modal from "./Modal";
import { MAX_NAME_LENGTH } from "@/lib/projects";

export interface FirstPageDialogProps {
  open: boolean;
  /** Named in the dialog, so it is clear which project this page lands in. */
  projectName: string;
  /** The name the project's page already carries — the field starts on it. */
  defaultName: string;
  onSubmit: (name: string, url: string) => void;
  onClose: () => void;
}

const FIELD =
  "w-full rounded border border-ink-700 bg-ink-850 px-2.5 py-2 text-[12px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-press-violet";
const LABEL =
  "text-[10px] font-medium tracking-[0.12em] text-press-cyan uppercase";

/**
 * The page a new project opens on, asked for the moment the project exists.
 *
 * A project is only ever a container: nothing can be captured until a page has
 * a URL. Asking here means the new project lands ready to shoot, instead of
 * opening on a blank "Home" whose URL is somewhere in the pages gallery.
 */
export default function FirstPageDialog({
  open,
  projectName,
  defaultName,
  onSubmit,
  onClose,
}: FirstPageDialogProps) {
  if (!open) return null;
  return (
    <Form
      projectName={projectName}
      defaultName={defaultName}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

function Form({
  projectName,
  defaultName,
  onSubmit,
  onClose,
}: Omit<FirstPageDialogProps, "open">) {
  const [name, setName] = useState(defaultName);
  const [url, setUrl] = useState("");

  const trimmedName = name.trim();

  const submit = () => {
    if (trimmedName.length === 0) return;
    onSubmit(trimmedName, url.trim());
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="First page"
      subtitle={projectName}
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Page name</span>
          <input
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            placeholder="Home"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Capture URL</span>
          <input
            type="url"
            value={url}
            placeholder="https://example.com"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className={`${FIELD} font-mono text-[11px]`}
          />
        </label>

        <p className="text-[10px] leading-4 text-ink-600">
          The page this project captures. Leave the URL empty to set it later —
          the pages gallery holds it, and every other page of the project.
        </p>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={trimmedName.length === 0}
            className="rounded border border-press-violet bg-press-violet/15 px-3 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
