import type { Page } from './projects';
import {
  assignViewportByDensity,
  type ViewportKey,
  type ViewportPreset,
} from './viewports';

/**
 * Pages from a Claude Design PNG export.
 *
 * Claude Design's Export ▸ "All artboards (.png)" saves a flat zip with one
 * `<artboard title>.png` per artboard, rendered at 2x (less for very large
 * ones). Titles usually end with the viewport — `Home – Desktop`,
 * `Home – Mobile` — so the screens become pages and each image lands on the
 * viewport its title names. A title with no viewport is routed by width.
 *
 * Pure: reading the zip, decoding and storing are the caller's.
 */

export interface ArchivePng {
  /** File name without folders, `.png` included. */
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

/** The PNGs of an archive, in archive order; anything else is left out. */
export function pngEntries(
  files: Map<string, Uint8Array<ArrayBuffer>>,
): ArchivePng[] {
  const pngs: ArchivePng[] = [];
  for (const [path, data] of files) {
    // macOS adds resource forks when it zips a folder
    if (path.startsWith('__MACOSX/')) continue;
    const name = path.split('/').pop() ?? '';
    if (name.startsWith('._') || !/\.png$/i.test(name)) continue;
    pngs.push({ name, data });
  }
  return pngs;
}

/**
 * A file name split into the screen and the viewport its title names, if any.
 * `Home – Desktop.png` → `Home` + desktop. The ` (2)` Claude Design adds to a
 * repeated title is dropped. The viewport is matched on the project's labels,
 * ignoring case; a dash (–, — or -) with spaces around separates it.
 */
export function splitTitle(
  fileName: string,
  presets: ViewportPreset[],
): { screen: string; viewportKey: ViewportKey | null } {
  const title = fileName
    .replace(/\.png$/i, '')
    .replace(/\s\(\d+\)$/, '')
    .trim();
  const match = /^(.*\S)\s+[–—-]\s+([^–—-]+)$/.exec(title);
  if (match) {
    const label = match[2].trim().toLowerCase();
    const preset = presets.find((p) => p.label.toLowerCase() === label);
    if (preset) return { screen: match[1], viewportKey: preset.key };
  }
  return { screen: title || 'Untitled', viewportKey: null };
}

export interface ImportItem {
  name: string;
  /** Pixel size of the decoded PNG. */
  width: number;
  height: number;
}

export interface PlannedShot<T extends ImportItem = ImportItem> {
  key: ViewportKey;
  item: T;
}

export interface PlannedPage<T extends ImportItem = ImportItem> {
  name: string;
  /** The page of the project it updates, or null for a new page. */
  existingPageId: string | null;
  shots: PlannedShot<T>[];
}

/**
 * One page per screen, in archive order. A screen that already has a page of
 * the same name (ignoring case) updates that page rather than adding another,
 * so dropping a newer export again refreshes the designs. Two images for the
 * same screen and viewport cannot share a page: the later one starts
 * `<screen> (2)`.
 */
export function planDesignImport<T extends ImportItem>(
  items: T[],
  presets: ViewportPreset[],
  pages: Pick<Page, 'id' | 'name'>[],
): PlannedPage<T>[] {
  const planned: PlannedPage<T>[] = [];
  const byName = new Map<string, PlannedPage<T>>();
  const existing = new Map(
    pages.map((page) => [page.name.toLowerCase(), page.id]),
  );

  for (const item of items) {
    const { screen, viewportKey } = splitTitle(item.name, presets);
    const key = viewportKey ?? assignViewportByDensity(item.width, presets);
    for (let n = 1; ; n++) {
      const name = n === 1 ? screen : `${screen} (${n})`;
      const id = name.toLowerCase();
      let page = byName.get(id);
      if (!page) {
        page = { name, existingPageId: existing.get(id) ?? null, shots: [] };
        byName.set(id, page);
        planned.push(page);
      }
      if (page.shots.some((shot) => shot.key === key)) continue;
      page.shots.push({ key, item });
      break;
    }
  }
  return planned;
}
