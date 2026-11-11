'use client';

import { useState } from 'react';
import { elapsedLabel, savedAtLabel } from '@/lib/elapsed';
import { MAX_NAME_LENGTH } from '@/lib/projects';
import type { HistoryEntry } from '@/lib/storage';
import { type ViewportKey } from '@/lib/viewports';

export interface SnapshotHistoryProps {
  /** Display name of each viewport an entry may have been archived from. */
  viewportLabels: Record<ViewportKey, string>;
  entries: HistoryEntry[]; // newest first
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
  /** Archives the Figma export on the viewport the canvas is showing. */
  onSave: () => void;
  canSave: boolean;
  /** Why saving is unavailable, printed on the disabled button. */
  saveHint: string | null;
}

const BTN = 'ps-btn text-[11px] transition-none';
const FIELD = 'ps-input px-2 text-[11px] placeholder:text-ps-500';

/**
 * The page's saved Figma exports, and the button that adds to them.
 *
 * Only the Figma layer is ever archived: the capture is a picture of the site
 * as it is right now, re-shootable in a click, while the export is a file
 * someone handed over and may never hand over again. So a snapshot is one
 * export, its alignment, and whatever you renamed it to.
 */
export default function SnapshotHistory({
  entries,
  viewportLabels,
  onLoad,
  onDelete,
  onRename,
  onSave,
  canSave,
  saveHint,
}: SnapshotHistoryProps) {
  // Reading the clock during render is impure, so it is read once on mount.
  // The labels are coarse and the panel is long-lived, so a stale minute is
  // not worth a ticking timer.
  const [now] = useState(() => Date.now());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  // Delete asks once, in place — the blob is the only copy the app has
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const commitRename = () => {
    if (renamingId === null) return;
    const trimmed = draft.trim();
    if (trimmed.length > 0) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        title={saveHint ?? "Archive this viewport's Figma export (S)"}
        className={`${BTN} flex items-center justify-center gap-1.5 py-1.5`}
      >
        <span aria-hidden="true" className="text-press-magenta">
          ＋
        </span>
        Save current export
      </button>
      {saveHint && (
        <p className="text-[10px] leading-4 text-ps-500">{saveHint}</p>
      )}

      {entries.length === 0 ? (
        <p className="text-[10px] leading-4 text-ps-500">
          Nothing archived yet. A snapshot keeps the Figma export and the offset
          you lined it up at — the capture is never saved, it is re-shot.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {entries.map((entry) => {
            const renaming = renamingId === entry.id;
            const confirming = confirmingId === entry.id;
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded border border-ps-700 bg-ps-850 px-2 py-1.5"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="shrink-0 text-[10px] font-semibold tracking-wide text-press-magenta uppercase">
                    {viewportLabels[entry.viewport] ?? entry.viewport}
                  </span>
                  {renaming ? (
                    <input
                      type="text"
                      value={draft}
                      autoFocus
                      maxLength={MAX_NAME_LENGTH}
                      aria-label="Snapshot name"
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className={`${FIELD} min-w-0 flex-1 py-0.5`}
                    />
                  ) : (
                    <span
                      className="min-w-0 flex-1 truncate text-[11px] text-ps-200"
                      title={entry.fileName}
                    >
                      {entry.fileName}
                    </span>
                  )}
                </div>

                <span className="font-mono text-[10px] text-ps-500 tabular-nums">
                  {savedAtLabel(entry.savedAt)} ·{' '}
                  {elapsedLabel(entry.savedAt, now)} · offset{' '}
                  {entry.offsetY > 0 ? '+' : ''}
                  {entry.offsetY}px
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onLoad(entry)}
                    title={`Put this export back on ${viewportLabels[entry.viewport] ?? entry.viewport}`}
                    className={`${BTN} flex-1 py-1`}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(entry.id);
                      setDraft(entry.fileName);
                      setConfirmingId(null);
                    }}
                    className={`${BTN} flex-1 py-1`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      confirming
                        ? onDelete(entry.id)
                        : setConfirmingId(entry.id)
                    }
                    onBlur={() => setConfirmingId(null)}
                    aria-label={`Delete the ${entry.fileName} snapshot`}
                    className={`${BTN} flex-1 py-1 ${
                      confirming ? 'text-press-red' : ''
                    }`}
                  >
                    {confirming ? 'Sure?' : 'Delete'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
