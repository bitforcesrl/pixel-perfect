import type {
  ViewportKey,
  ViewportPreset,
  ViewportSlot,
} from '@/lib/viewports';

export interface ViewportStatusListProps {
  /** The project's enabled viewports, in the order they are shown. */
  presets: ViewportPreset[];
  /** Each viewport's layers and capture state. */
  slots: Record<ViewportKey, ViewportSlot>;
  /** The viewports whose Figma frame is being rendered right now. */
  figmaBusy: Record<ViewportKey, boolean>;
}

/** The Figma layer of one viewport, as a word and an ink. */
function figmaStatus(
  slot: ViewportSlot | undefined,
  busy: boolean,
): { label: string; className: string } {
  if (busy) {
    return { label: 'rendering…', className: 'text-press-magenta' };
  }
  if (slot?.figmaSrc) {
    return { label: 'figma ✓', className: 'text-press-magenta' };
  }
  return { label: 'no figma', className: 'text-ink-500' };
}

/** The site layer of one viewport, as a word and an ink. */
function siteStatus(slot: ViewportSlot | undefined): {
  label: string;
  className: string;
} {
  switch (slot?.status) {
    case 'capturing':
      return { label: 'capturing…', className: 'text-press-cyan' };
    case 'error':
      return { label: 'capture failed', className: 'text-press-red' };
    default:
      return slot?.screenshot
        ? { label: 'site ✓', className: 'text-press-cyan' }
        : { label: 'no site', className: 'text-ink-500' };
  }
}

/**
 * Every viewport of the project with where its two layers stand — the Figma
 * export and the site capture. Shown on the empty canvas, and over the whole
 * app while a capture or an export is running.
 *
 * Purely presentational: the workspace owns the state and passes it in.
 */
export default function ViewportStatusList({
  presets,
  slots,
  figmaBusy,
}: ViewportStatusListProps) {
  if (presets.length === 0) {
    return (
      <p className="text-center text-xs text-ink-500">
        No viewport is enabled for this project.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 text-left">
      {presets.map((preset) => {
        // A viewport added mid-run may not have a slot yet
        const slot = slots[preset.key] as ViewportSlot | undefined;
        const figma = figmaStatus(slot, figmaBusy[preset.key] === true);
        const site = siteStatus(slot);
        const working =
          figmaBusy[preset.key] === true || slot?.status === 'capturing';
        return (
          <li
            key={preset.key}
            aria-busy={working}
            className={`flex items-center justify-between gap-3 rounded border bg-ink-900 px-3 py-2 text-xs ${
              working ? 'border-ink-600' : 'border-ink-800'
            }`}
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-medium text-ink-200">
                {preset.label}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-ink-500 tabular-nums">
                {preset.width}×{preset.height}
              </span>
            </span>
            <span className="flex shrink-0 gap-3 text-[11px]">
              <span className={figma.className}>{figma.label}</span>
              <span className={site.className}>{site.label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
