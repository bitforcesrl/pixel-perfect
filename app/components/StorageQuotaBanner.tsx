'use client';

import { formatBytes, type StorageQuota } from '@/lib/storage-quota';

export interface StorageQuotaBannerProps {
  quota: StorageQuota;
  /** Opens the Projects list, where old projects are exported and deleted. */
  onManageProjects: () => void;
  onDismiss: () => void;
}

/**
 * Says the browser is running out of room for this app's work, and what to do
 * about it. Dumb: the workspace decides when it shows.
 *
 * "High" is a heads-up the user can put away; "full" means a save has already
 * been refused, so it says plainly that the last change may not be kept.
 */
export default function StorageQuotaBanner({
  quota,
  onManageProjects,
  onDismiss,
}: StorageQuotaBannerProps) {
  const full = quota.level === 'full';
  const known = quota.quota > 0;
  const share = known ? Math.round((quota.usage / quota.quota) * 100) : null;

  return (
    <div
      role={full ? 'alert' : 'status'}
      className={`flex items-start gap-3 border-b px-4 py-2 text-sm ${
        full
          ? 'border-press-red/40 bg-press-red/10 text-press-red'
          : 'border-press-amber/40 bg-press-amber/10 text-press-amber'
      }`}
    >
      <p className="min-w-0 flex-1">
        {full || share === null
          ? 'Browser storage is full'
          : `Browser storage is ${share}% full`}
        {known && (
          <span className="opacity-80">
            {' '}
            ({formatBytes(quota.usage)} of {formatBytes(quota.quota)})
          </span>
        )}
        {full ? '. The last change could not be saved. ' : '. '}
        Export the projects you want to keep, then delete them to free space
        {full ? '' : ' before saving more captures'}.{' '}
        <button
          type="button"
          onClick={onManageProjects}
          className="font-medium underline underline-offset-2"
        >
          Open Projects
        </button>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss storage warning"
        title="Dismiss"
        className="-mr-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
