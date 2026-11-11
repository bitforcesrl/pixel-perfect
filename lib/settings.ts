import {MAX_DIM, MIN_DIM} from './validation';
import {
  VIEWPORT_LABELS,
  VIEWPORT_PRESETS,
  createViewportKey,
  type DefaultViewportKey,
  type ViewportKey,
  type ViewportPreset,
} from './viewports';

/** One viewport's capture configuration: its name, whether it runs, and at what size. */
export interface ViewportSetting {
  label: string;
  enabled: boolean;
  width: number;
  height: number;
}

/**
 * Every viewport of a project, keyed by id. The record's insertion order is the
 * order the settings list shows them in.
 */
export type ViewportSettings = Record<ViewportKey, ViewportSetting>;

function defaultsFor(key: DefaultViewportKey, enabled = true): ViewportSetting {
  const {label, width, height} = VIEWPORT_PRESETS[key];
  return {label, enabled, width, height};
}

/**
 * The sizes that used to be compiled in. Tablet starts off: designs rarely ship
 * a third breakpoint, and it is one capture per run either way. Anyone who does
 * have tablet exports turns it back on in settings.
 */
export const DEFAULT_SETTINGS: ViewportSettings = {
  mobile: defaultsFor('mobile'),
  tablet: defaultsFor('tablet', false),
  desktop: defaultsFor('desktop'),
};

/**
 * A dimension the API will accept, or the default when the stored value is not
 * a usable number at all. The bounds are `validateScreenshotRequest`'s own, so
 * the form can never produce a capture the route rejects.
 */
function clampDimension(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(value)));
}

/** What a stored viewport falls back to field by field. */
function fallbackFor(key: ViewportKey): ViewportSetting {
  return (
    DEFAULT_SETTINGS[key] ?? {
      label: key,
      enabled: true,
      width: VIEWPORT_PRESETS.desktop.width,
      height: VIEWPORT_PRESETS.desktop.height,
    }
  );
}

/**
 * The only way settings enter the app.
 *
 * Whatever is in the database — written by an older version, edited by hand,
 * half missing — comes out as something every consumer can use: each viewport
 * merged over its default, each dimension in range. A record written before
 * viewports could be added or removed has exactly the three built-in keys and
 * no labels, and reads back as it always did. A record that enables nothing is
 * an app with no function and no way back, so it is discarded whole.
 */
export function sanitizeSettings(raw: unknown): ViewportSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;

  const settings: ViewportSettings = {};
  for (const [key, stored] of Object.entries(raw)) {
    if (typeof stored !== 'object' || stored === null) continue;
    const fallback = fallbackFor(key);
    const {label, enabled, width, height} = stored as Partial<ViewportSetting>;
    settings[key] = {
      label:
        typeof label === 'string' && label.trim() !== ''
          ? label.trim()
          : fallback.label,
      enabled: typeof enabled === 'boolean' ? enabled : fallback.enabled,
      width: clampDimension(width, fallback.width),
      height: clampDimension(height, fallback.height),
    };
  }

  return Object.values(settings).some((setting) => setting.enabled)
    ? settings
    : DEFAULT_SETTINGS;
}

/** True when turning this viewport off (or removing it) would leave none enabled. */
export function isLastEnabled(
  settings: ViewportSettings,
  key: ViewportKey,
): boolean {
  return (
    settings[key]?.enabled === true &&
    Object.entries(settings).every(
      ([other, setting]) => other === key || !setting.enabled,
    )
  );
}

/**
 * A new viewport, enabled, appended to the list. Starts one step wider than the
 * widest so far — a name the user has not used yet and a size that does not
 * collide with an existing one.
 */
export function addViewport(settings: ViewportSettings): {
  settings: ViewportSettings;
  key: ViewportKey;
} {
  const key = createViewportKey();
  const existing = Object.values(settings);
  const widest = existing.reduce(
    (max, setting) => (setting.width > max.width ? setting : max),
    existing[0] ?? fallbackFor(key),
  );
  const labels = new Set(existing.map((setting) => setting.label));
  let n = existing.length + 1;
  while (labels.has(`Viewport ${n}`)) n++;
  return {
    key,
    settings: {
      ...settings,
      [key]: {
        label: `Viewport ${n}`,
        enabled: true,
        width: Math.min(MAX_DIM, widest.width + 100),
        height: widest.height,
      },
    },
  };
}

/** The settings without this viewport. Refused when it is the last enabled one. */
export function removeViewport(
  settings: ViewportSettings,
  key: ViewportKey,
): ViewportSettings {
  if (!(key in settings) || isLastEnabled(settings, key)) return settings;
  const next = {...settings};
  delete next[key];
  return next;
}

function toPreset(key: ViewportKey, setting: ViewportSetting): ViewportPreset {
  return {
    key,
    label: setting.label,
    width: setting.width,
    height: setting.height,
  };
}

/**
 * The viewports the app actually works with, ascending by width.
 *
 * One list, one order: the viewer's fallback, the cards, and the width-based
 * Figma routing all read this rather than deciding for themselves what counts
 * as enabled or what comes first.
 */
export function enabledPresets(settings: ViewportSettings): ViewportPreset[] {
  return Object.entries(settings)
    .filter(([, setting]) => setting.enabled)
    .map(([key, setting]) => toPreset(key, setting))
    .sort((a, b) => a.width - b.width);
}

/**
 * Every viewport, enabled or not, ascending by width.
 *
 * Figma routing must consider all viewports so a 375 px export always lands on
 * mobile even when mobile is temporarily disabled.  Capture and display still
 * use {@link enabledPresets}.
 */
export function allPresets(settings: ViewportSettings): ViewportPreset[] {
  return Object.entries(settings)
    .map(([key, setting]) => toPreset(key, setting))
    .sort((a, b) => a.width - b.width);
}

/** Each viewport's display name, for places that only hold its id. */
export function viewportLabels(
  settings: ViewportSettings,
): Record<ViewportKey, string> {
  const labels: Record<ViewportKey, string> = {...VIEWPORT_LABELS};
  for (const [key, setting] of Object.entries(settings)) {
    labels[key] = setting.label;
  }
  return labels;
}
