/**
 * Every keyboard shortcut the app answers, grouped the way the menu bar groups
 * its commands. Read by the help dialog; keep it in step with the handlers in
 * `Workspace.tsx`, `ComparisonViewer.tsx` and `AnnotationLayer.tsx`.
 *
 * Keys are written as they are printed beside the menu items — `⇧` for Shift,
 * arrows as glyphs — so the help dialog and the menus read the same.
 */

export interface Shortcut {
  /** One entry per key in the chord, e.g. `["⇧", "C"]`. */
  keys: string[];
  description: string;
}

export interface ShortcutGroup {
  title: string;
  /** When the group applies, if not always. */
  note?: string;
  shortcuts: Shortcut[];
}

/** Every shortcut the app answers, grouped as the menu bar groups them. */
export function shortcutGroups(): ShortcutGroup[] {
  return [
    {
      title: 'File',
      shortcuts: [
        { keys: ['N'], description: 'New project' },
        { keys: ['P'], description: 'Pages' },
        { keys: ['⇧', 'P'], description: 'Projects' },
        { keys: ['E'], description: 'Download diff map' },
      ],
    },
    {
      title: 'Align',
      note: 'Move the Figma layer over the capture',
      shortcuts: [
        { keys: ['↑'], description: 'Move Figma up 1px' },
        { keys: ['↓'], description: 'Move Figma down 1px' },
        { keys: ['⇧', '↑'], description: 'Move Figma up 10px' },
        { keys: ['⇧', '↓'], description: 'Move Figma down 10px' },
        { keys: ['V'], description: 'Drag moves the Figma layer' },
      ],
    },
    {
      title: 'View',
      shortcuts: [
        { keys: ['1'], description: 'Split' },
        { keys: ['2'], description: 'Overlay' },
        { keys: ['3'], description: 'Tap' },
        { keys: ['4'], description: 'Side by side' },
        { keys: ['+'], description: 'Zoom in' },
        { keys: ['−'], description: 'Zoom out' },
        { keys: ['F'], description: 'Zoom to fit' },
        { keys: ['0'], description: 'Actual size' },
        { keys: ['B'], description: 'Show / hide inspector' },
      ],
    },
    {
      title: 'Canvas',
      note: 'Mouse gestures on the comparison',
      shortcuts: [
        {
          keys: ['Space', 'drag'],
          description: 'Pan instead of moving the split divider',
        },
        {
          keys: ['⌥', 'drag'],
          description: 'Pan in split mode without holding Space',
        },
      ],
    },
    {
      title: 'Tools',
      shortcuts: [
        { keys: ['G'], description: 'Add vertical guide' },
        { keys: ['⇧', 'G'], description: 'Add horizontal guide' },
        { keys: ['D'], description: 'Pen' },
        { keys: ['Z'], description: 'Undo last stroke' },
        { keys: ['S'], description: 'Save the Figma export to History' },
      ],
    },
    {
      title: 'Selected guide',
      note: 'With a guide focused on the canvas',
      shortcuts: [
        { keys: ['←', '↑'], description: 'Move the guide back' },
        { keys: ['→', '↓'], description: 'Move the guide forward' },
        { keys: ['Delete'], description: 'Remove the guide' },
      ],
    },
    {
      title: 'Capture',
      // Replacing a layer is the one thing a stray key must not do: these
      // need Shift, and the every-viewport runs have no key at all
      note: 'Every viewport at once: Capture menu or Layers panel',
      shortcuts: [
        // Through the Chrome extension; without it, the key opens the
        // dialog that installs it
        { keys: ['⇧', 'C'], description: 'Capture this viewport' },
        // The export scale follows the viewport width (2x mobile → 1x
        // desktop), so the description does not promise one
        { keys: ['⇧', 'M'], description: "Export this viewport's Figma frame" },
        { keys: ['I'], description: 'Upload Figma exports' },
        { keys: [','], description: 'Viewport settings' },
      ],
    },
    {
      title: 'Menus & dialogs',
      shortcuts: [
        { keys: ['←', '→'], description: 'Switch menu while one is open' },
        { keys: ['↑', '↓'], description: 'Walk the items of an open menu' },
        { keys: ['Esc'], description: 'Close the menu or dialog' },
        { keys: ['?'], description: 'Show these shortcuts' },
      ],
    },
  ];
}
