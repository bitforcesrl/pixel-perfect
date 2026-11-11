'use client';

import { useState, useSyncExternalStore } from 'react';
import Modal from './Modal';
import {
  clearFigmaToken,
  loadFigmaToken,
  saveFigmaToken,
  subscribeFigmaToken,
} from '@/lib/figma-token';

export interface FigmaTokenDialogProps {
  open: boolean;
  onClose: () => void;
  /** Why the dialog opened, when it opened because an export was refused. */
  error: string | null;
  /** The token changed — the workspace re-reads it and may retry. */
  onSaved: () => void;
}

const FIELD =
  'w-full rounded border border-ink-700 bg-ink-950 px-2.5 py-1.5 font-mono text-[12px] text-ink-100 placeholder:text-ink-600 focus:border-press-violet focus:outline-none';

/**
 * Where the user's own Figma token is typed.
 *
 * Frames are rendered by the Figma REST API, and this deployment has no token
 * of its own — so the token is the user's, kept in their browser and sent with
 * each export. Same terms as the Browserless key.
 */
export default function FigmaTokenDialog({
  open,
  onClose,
  error,
  onSaved,
}: FigmaTokenDialogProps) {
  const stored = useSyncExternalStore(
    subscribeFigmaToken,
    loadFigmaToken,
    () => null,
  );
  const [value, setValue] = useState(() => loadFigmaToken() ?? '');

  const trimmed = value.trim();

  const handleSave = () => {
    if (trimmed === '') return;
    saveFigmaToken(trimmed);
    onSaved();
    onClose();
  };

  const handleRemove = () => {
    clearFigmaToken();
    setValue('');
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Figma token"
      subtitle={stored ? 'saved in this browser' : 'not set'}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="rounded border border-press-red/40 bg-press-red/10 px-3 py-2 text-[12px] leading-5 text-press-red"
          >
            {error}
          </p>
        )}

        <p className="text-[12px] leading-5 text-ink-400">
          Frames are rendered at 2x by the Figma API, and this deployment has no
          token of its own. In Figma open{' '}
          <span className="text-ink-200">
            Settings ▸ Security ▸ Personal access tokens
          </span>
          , generate one with the{' '}
          <span className="text-ink-200">File content: Read-only</span> scope
          and paste it below — it is kept in this browser and sent with each
          export, never stored on the server.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">
            Personal access token
          </span>
          <input
            type="password"
            value={value}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="figd_…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            className={FIELD}
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={trimmed === '' || trimmed === stored}
            className="rounded bg-press-magenta px-3 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-press-magenta/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save token
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={stored === null}
            className="rounded border border-ink-700 px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-press-red/60 hover:text-press-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
          <span className="ml-auto text-[11px] text-ink-600">
            Clearing site data clears the token.
          </span>
        </div>
      </div>
    </Modal>
  );
}
