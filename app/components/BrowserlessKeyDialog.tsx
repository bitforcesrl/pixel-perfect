'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Modal from './Modal';
import {
  clearKey,
  ensureKeyLoaded,
  loadKey,
  saveKey,
  subscribeKey,
} from '@/lib/browserless-key';

export interface BrowserlessKeyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Why the dialog opened, when it opened because a capture was refused. */
  error: string | null;
  /** The key changed — the workspace re-reads it and may retry. */
  onSaved: () => void;
}

const FIELD =
  'w-full rounded border border-ink-700 bg-ink-950 px-2.5 py-1.5 font-mono text-[12px] text-ink-100 placeholder:text-ink-600 focus:border-press-violet focus:outline-none';

/**
 * Where the user's own Browserless key is typed.
 *
 * Captures run in a browser at browserless.io, and this deployment has no token
 * of its own — so the key is the user's, kept in this browser's IndexedDB with
 * the app's other settings and sent with each capture. It is never written to
 * the server, which is the whole reason this dialog exists rather than an
 * environment variable.
 */
export default function BrowserlessKeyDialog({
  open,
  onClose,
  error,
  onSaved,
}: BrowserlessKeyDialogProps) {
  // The dialog is mounted when it opens, so the field starts on whatever is
  // stored and the store keeps the rest of the sheet honest from there
  const stored = useSyncExternalStore(subscribeKey, loadKey, () => null);
  const [value, setValue] = useState(() => loadKey() ?? '');
  // The field was touched — a late database read must not overwrite typing
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  // A write the database refused: the key still works until the next reload
  const [saveError, setSaveError] = useState<string | null>(null);

  // Opened before the stored key was read: fill the field once it arrives
  useEffect(() => {
    let cancelled = false;
    void ensureKeyLoaded().then((key) => {
      if (!cancelled && !edited && key) setValue(key);
    });
    return () => {
      cancelled = true;
    };
  }, [edited]);

  const trimmed = value.trim();

  const handleSave = async () => {
    if (trimmed === '' || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      await saveKey(trimmed);
      onSaved();
      onClose();
    } catch (err) {
      console.error('pixel-perfect: could not save the Browserless key', err);
      // The key is already in use for this session; say it will not last
      setSaveError(
        'The key could not be saved in this browser (storage blocked or full). It works until you reload — allow site data to keep it.',
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (busy) return;
    setBusy(true);
    setSaveError(null);
    setValue('');
    setEdited(true);
    try {
      await clearKey();
    } catch (err) {
      console.error('pixel-perfect: could not remove the Browserless key', err);
      setSaveError(
        'The key was removed for this session but could not be deleted from this browser — it may come back after a reload.',
      );
    } finally {
      setBusy(false);
      onSaved();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Browserless key"
      subtitle={stored ? 'saved in this browser' : 'not set'}
    >
      <div className="flex flex-col gap-4">
        {(error || saveError) && (
          <p
            role="alert"
            className="rounded border border-press-red/40 bg-press-red/10 px-3 py-2 text-[12px] leading-5 text-press-red"
          >
            {saveError ?? error}
          </p>
        )}

        <p className="text-[12px] leading-5 text-ink-400">
          Captures run in a browser hosted at{' '}
          <a
            href="https://www.browserless.io/"
            target="_blank"
            rel="noreferrer"
            className="text-press-cyan underline underline-offset-2"
          >
            browserless.io
          </a>
          , and this deployment has no key of its own. Create a free account,
          copy the API token from your dashboard and paste it below — it is
          saved in this browser with the app&apos;s settings and sent with each
          capture, never stored on the server.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">
            API token
          </span>
          <input
            type="password"
            value={value}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="2S1a…"
            onChange={(e) => {
              setEdited(true);
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
            className={FIELD}
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || trimmed === '' || trimmed === stored}
            className="rounded bg-press-cyan px-3 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-press-cyan/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save key
          </button>
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={busy || stored === null}
            className="rounded border border-ink-700 px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-press-red/60 hover:text-press-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
          <span className="ml-auto text-[11px] text-ink-600">
            Clearing site data clears the key.
          </span>
        </div>
      </div>
    </Modal>
  );
}
