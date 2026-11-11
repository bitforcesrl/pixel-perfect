'use client';

import { useState } from 'react';
import type { ExportOptions } from '@/lib/transfer';
import Modal from './Modal';

export interface ExportProjectDialogProps {
  open: boolean;
  /** Shown in the message, so it is clear which project is being packed. */
  projectName: string;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

/**
 * Asks what goes into a project export before the ZIP is built.
 *
 * Dumb component: it only collects the choices and hands them back through
 * `onExport` — building and downloading the archive stays with the caller.
 */
export default function ExportProjectDialog(props: ExportProjectDialogProps) {
  // Mounted only while open, so each opening starts from the defaults
  if (!props.open) return null;
  return <Dialog {...props} />;
}

function Dialog({ projectName, onExport, onCancel }: ExportProjectDialogProps) {
  const [includeHistory, setIncludeHistory] = useState(true);

  return (
    <Modal open onClose={onCancel} title="Export project" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-5 text-ink-300">
          Packs <span className="font-medium text-ink-100">{projectName}</span>{' '}
          into a ZIP: pages, URLs, notes, settings, captures and Figma exports.
        </p>

        <label className="flex cursor-pointer items-start gap-2.5 rounded border border-ink-700 bg-ink-850 px-3 py-2.5">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => setIncludeHistory(e.target.checked)}
            className="mt-0.5 accent-press-violet"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] text-ink-100">
              Include snapshot history
            </span>
            <span className="text-[11px] leading-4 text-ink-500">
              Saved Figma snapshots of every page. They stay even after a
              viewport is cleared, and can make the archive much larger.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onExport({ includeHistory })}
            className="rounded border border-press-violet bg-press-violet/15 px-3 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25"
          >
            Export
          </button>
        </div>
      </div>
    </Modal>
  );
}
