'use client';

import { useState, type ReactNode } from 'react';
import Modal from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What is about to happen, in the plainest words available. */
  message: ReactNode;
  confirmLabel: string;
  /** The button that does nothing. "Cancel" unless doing nothing has a name. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button, for anything that destroys work. */
  danger?: boolean;
  /**
   * Type-to-confirm phrase. Given one, the confirm button stays dead until it
   * is typed exactly — for the destructive end of destructive, where a
   * mis-aimed Return should not be enough.
   */
  passkey?: string;
}

/**
 * Ask before doing something that cannot be taken back.
 *
 * Cancel is the default focus and Escape leaves: the dialog is built so that
 * the fastest thing to do is nothing.
 */
export default function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <Dialog {...props} />;
}

function Dialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  passkey,
}: ConfirmDialogProps) {
  // Mounted only while open, so each opening starts from an empty field
  const [typed, setTyped] = useState('');
  const unlocked = passkey === undefined || typed.trim() === passkey;

  const confirm = () => {
    if (!unlocked) return;
    onConfirm();
  };

  return (
    <Modal open onClose={onCancel} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className="text-[12px] leading-5 text-ink-300">{message}</div>

        {passkey !== undefined && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-400">
              Type{' '}
              <span className="font-mono font-semibold text-press-red">
                {passkey}
              </span>{' '}
              to confirm
            </span>
            <input
              type="text"
              value={typed}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${passkey} to confirm`}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') confirm();
              }}
              className="rounded border border-ink-600 bg-ink-850 px-2.5 py-1.5 font-mono text-[12px] text-ink-100 outline-none focus:border-press-red"
            />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus={passkey === undefined}
            className="rounded border border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!unlocked}
            className={`rounded border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              danger
                ? 'border-press-red bg-press-red/15 text-press-red hover:bg-press-red/25'
                : 'border-press-violet bg-press-violet/15 text-press-violet hover:bg-press-violet/25'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
