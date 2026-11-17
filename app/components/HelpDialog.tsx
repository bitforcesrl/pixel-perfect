'use client';

import { shortcutGroups } from '@/lib/shortcuts';
import Modal from './Modal';
import ShortcutsReference from './ShortcutsReference';

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Help ▸ Keyboard shortcuts, as a dialog over the canvas so the work behind it
 * stays exactly where it was. The keys themselves come from the catalog.
 */
export default function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      subtitle="⇧ for anything that replaces a layer — off while typing or with a dialog open"
      size="lg"
    >
      <ShortcutsReference groups={shortcutGroups()} />
    </Modal>
  );
}
