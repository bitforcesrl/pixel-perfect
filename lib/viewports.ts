import type { ScreenshotResult } from './validation';

/**
 * A viewport's id within its project. The three built-in ones keep the names
 * they always had, so records stored under them stay where they are; any
 * viewport added since gets a generated id.
 */
export type ViewportKey = string;

/** The viewports a project starts with, and the only ones before they became a list. */
export const VIEWPORT_KEYS = ['mobile', 'tablet', 'desktop'] as const;

export type DefaultViewportKey = (typeof VIEWPORT_KEYS)[number];

export interface ViewportPreset {
  key: ViewportKey;
  label: string;
  width: number;
  height: number;
}

export const VIEWPORT_LABELS: Record<DefaultViewportKey, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
};

/**
 * The sizes a project starts from. Not the sizes it runs at: `lib/settings.ts`
 * builds `DEFAULT_SETTINGS` from these, and the user's stored settings decide
 * what is actually captured.
 */
export const VIEWPORT_PRESETS: Record<DefaultViewportKey, ViewportPreset> = {
  mobile: {
    key: 'mobile',
    label: VIEWPORT_LABELS.mobile,
    width: 375,
    height: 812,
  },
  tablet: {
    key: 'tablet',
    label: VIEWPORT_LABELS.tablet,
    width: 768,
    height: 1024,
  },
  desktop: {
    key: 'desktop',
    label: VIEWPORT_LABELS.desktop,
    width: 1440,
    height: 900,
  },
};

export const VIEWPORT_LIST: ViewportPreset[] = VIEWPORT_KEYS.map(
  (key) => VIEWPORT_PRESETS[key],
);

export type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'error';

export interface ViewportSlot {
  screenshot: ScreenshotResult | null;
  /** Object URL of the uploaded Figma export */
  figmaSrc: string | null;
  figmaFileName: string | null;
  /** Rendered height of the Figma layer, null until the viewer measures it */
  figmaHeight: number | null;
  offsetY: number;
  status: CaptureStatus;
  error: string | null;
}

export type ViewportSlots = Record<ViewportKey, ViewportSlot>;

/** A fresh viewport id — never one of the built-in names. */
export function createViewportKey(): ViewportKey {
  return `vp-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Which viewport a Figma export belongs to, from its pixel width alone.
 *
 * The export lands on the preset whose configured width is nearest, which puts
 * the boundary at the midpoint between two of them. Whatever the export's scale
 * factor, the width tells us which layout the designer was drawing — and since
 * the presets are the user's own numbers, changing them moves the boundaries
 * with them.
 *
 * `presets` must not be empty; `sanitizeSettings` guarantees at least one
 * enabled viewport.
 */
export function assignViewport(
  width: number,
  presets: ViewportPreset[],
): ViewportKey {
  return presets.reduce((nearest, preset) =>
    Math.abs(preset.width - width) < Math.abs(nearest.width - width)
      ? preset
      : nearest,
  ).key;
}

/**
 * The pixel densities an uploaded image is assumed to have been exported or
 * captured at: plain 1x, or the 2x that Figma exports and retina screenshots
 * default to. Order matters — on a tie the 1x reading wins.
 */
export const UPLOAD_SCALES = [1, 2] as const;

/**
 * Which viewport an uploaded image belongs to, reading its width at every
 * density in `scales`.
 *
 * Unlike `assignViewport`, a 750 px image is not "nearest to 768, so tablet":
 * at 2x it is exactly a 375 px layout, so it lands on mobile. Each preset is
 * scored by the smallest gap, in CSS px, between its width and the image's
 * width divided by any of the scales; the lowest score wins, ties going to
 * the earlier scale and then to the earlier preset.
 *
 * `presets` must not be empty; `sanitizeSettings` guarantees at least one
 * enabled viewport.
 */
export function assignViewportByDensity(
  width: number,
  presets: ViewportPreset[],
  scales: readonly number[] = UPLOAD_SCALES,
): ViewportKey {
  let best = presets[0];
  let bestGap = Infinity;
  for (const scale of scales) {
    const cssWidth = width / scale;
    for (const preset of presets) {
      const gap = Math.abs(preset.width - cssWidth);
      // Strictly smaller: an equal gap keeps the lower scale's match
      if (gap < bestGap) {
        best = preset;
        bestGap = gap;
      }
    }
  }
  return best.key;
}

export function createSlot(): ViewportSlot {
  return {
    screenshot: null,
    figmaSrc: null,
    figmaFileName: null,
    figmaHeight: null,
    offsetY: 0,
    status: 'idle',
    error: null,
  };
}

export function createSlots(): ViewportSlots {
  return {};
}

/** Shared by every viewport that holds nothing yet. Never mutated. */
const EMPTY_SLOT: ViewportSlot = createSlot();

/**
 * The slots with an entry for every key, so readers can index without
 * checking. Slots are only stored once something lands in them; the keys a
 * project has come from its settings and can grow at any time.
 */
export function fillSlots(
  slots: ViewportSlots,
  keys: Iterable<ViewportKey>,
): ViewportSlots {
  let filled: ViewportSlots | null = null;
  for (const key of keys) {
    if (slots[key]) continue;
    filled ??= { ...slots };
    filled[key] = EMPTY_SLOT;
  }
  return filled ?? slots;
}

/** One slot, an empty one when the viewport holds nothing yet. */
export function slotOf(slots: ViewportSlots, key: ViewportKey): ViewportSlot {
  return slots[key] ?? EMPTY_SLOT;
}

/** A viewport can be compared only once it holds both layers. */
export function isSlotReady(slot: ViewportSlot): boolean {
  return slot.screenshot !== null && slot.figmaSrc !== null;
}

/**
 * Either layer on its own is worth showing: the viewer displays whichever it
 * has until the other one arrives to compare against.
 */
export function isSlotViewable(slot: ViewportSlot): boolean {
  return slot.screenshot !== null || slot.figmaSrc !== null;
}

/**
 * The viewport the viewer should show: the caller's preference while it is
 * enabled and still holds a layer, otherwise the narrowest viewport that can
 * compare, and failing that the narrowest holding anything at all.
 */
export function firstReadyViewport(
  slots: ViewportSlots,
  preferred: ViewportKey | null,
  presets: ViewportPreset[],
): ViewportKey | null {
  if (
    preferred &&
    presets.some((preset) => preset.key === preferred) &&
    isSlotViewable(slotOf(slots, preferred))
  ) {
    return preferred;
  }
  return (
    presets.find((preset) => isSlotReady(slotOf(slots, preset.key)))?.key ??
    presets.find((preset) => isSlotViewable(slotOf(slots, preset.key)))?.key ??
    null
  );
}
