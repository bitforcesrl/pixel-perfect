/**
 * Dumb toast shown when a newer deploy is live. It only renders what it is
 * given and reports clicks; the update logic lives in useAppUpdate.
 */
export default function UpdateToast({
  isUpdating,
  onUpdate,
  onDismiss,
}: {
  isUpdating: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[1000] flex max-w-sm items-start gap-3 rounded-md border border-ink-800 bg-ink-900 p-4 text-sm text-ink-100 shadow-2xl shadow-black/50"
    >
      <span
        aria-hidden="true"
        className="mt-1.5 size-2 shrink-0 rounded-full bg-press-violet"
      />
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-semibold">
            A new version of Pixel Perfect is available
          </p>
          <p className="mt-1 text-ink-400">
            Reload to update. Your projects stay saved in this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUpdate}
            disabled={isUpdating}
            className="rounded bg-press-violet px-3 py-1.5 font-semibold text-ink-950 disabled:opacity-60"
          >
            {isUpdating ? 'Updating…' : 'Update now'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-3 py-1.5 text-ink-400 hover:text-ink-100"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
