'use client';

import UpdateToast from './UpdateToast';
import { useAppUpdate } from './useAppUpdate';

/**
 * Smart container mounted once in the root layout: registers the service
 * worker, watches for new deploys and shows the update toast when one is live.
 */
export default function AppUpdater() {
  const { updateAvailable, isUpdating, applyUpdate, dismiss } = useAppUpdate();
  if (!updateAvailable) return null;
  return (
    <UpdateToast
      isUpdating={isUpdating}
      onUpdate={applyUpdate}
      onDismiss={dismiss}
    />
  );
}
