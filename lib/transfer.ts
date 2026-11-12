import { readAsDataUrl } from './image';
import {
  createPage,
  createProject,
  MAX_PAGES,
  pageIds,
  sanitizeFigmaUrls,
  sanitizeName,
  type Project,
} from './projects';
import { sanitizeSettings } from './settings';
import {
  deleteProjectData,
  loadHistory,
  loadNotes,
  loadPreviews,
  loadSettings,
  loadSlots,
  saveFigma,
  saveHistoryEntry,
  saveNotes,
  savePreview,
  saveScreenshot,
  saveSettings,
} from './storage';
import { packTiles, TILES_MIME, unpackTiles } from './tile-container';
import type { ViewportKey } from './viewports';
import { createZip, readZip, type ZipEntry } from './zip';

/**
 * A project packed into one ZIP, to hand to a colleague who opens it in their
 * own browser.
 *
 * Everything lives in IndexedDB, so the only way work leaves this machine is
 * as a file. The archive carries a `manifest.json` describing the project —
 * pages, URLs, notes, viewport settings — and the images it points at sit next
 * to it as ordinary files, so the archive can be opened and looked through by
 * hand too. A tall picture stored as strips (`tile-container.ts`) is written
 * as a folder of its strips — one ordinary WebP each — and packed back into
 * one container on import.
 *
 * Importing is two steps: `readProjectArchive` opens and checks the file
 * without writing anything, so the caller can ask before it replaces a project
 * of the same name; `writeProjectArchive` then unpacks it as a new project
 * with new ids. Site passwords never leave this browser: exports leave them
 * out, so a ZIP can be passed around without handing over a store's password.
 */

const FORMAT = 'pixel-perfect-project';
/** 2: images may be folders of strips. Version 1 archives still import. */
const VERSION = 2;
const MANIFEST = 'manifest.json';

/** One image written as one file. */
interface FileRef {
  file: string;
  type: string;
}

/** One strip of a tiled image, top to bottom. */
interface StripRef {
  file: string;
  height: number;
}

/** A tiled image, written as a folder with one file per strip. */
interface TiledRef {
  type: typeof TILES_MIME;
  tiles: {
    width: number;
    height: number;
    /** Encoding of every strip */
    mime: string;
    strips: StripRef[];
  };
}

type ImageRef = FileRef | TiledRef;

interface ManifestSlot {
  screenshot: (ImageRef & { width: number; height: number }) | null;
  figma: (ImageRef & { fileName: string }) | null;
}

type ManifestSnapshot = ImageRef & {
  viewport: ViewportKey;
  fileName: string;
  offsetY: number;
  savedAt: number;
};

interface ManifestPage {
  name: string;
  url: string;
  /**
   * Written by exports made before passwords were kept out of the archive.
   * Still read back, so those files import the way they always did.
   */
  sitePassword?: string;
  /** Absent from exports made before pages carried Figma links. */
  figmaUrls?: Record<ViewportKey, string>;
  createdAt: number;
  notes: string;
  /** Already a small data URL — kept inline rather than as a file. */
  preview: string | null;
  slots: Record<ViewportKey, ManifestSlot>;
  snapshots: ManifestSnapshot[];
}

interface Manifest {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  project: { name: string };
  settings: unknown;
  pages: ManifestPage[];
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** A viewport key fit for a file name — generated keys are, this is for safety. */
function fileSafe(key: string): string {
  return key.replace(/[^\w-]/g, '_');
}

async function blobFrom(source: Blob | string): Promise<Blob> {
  return typeof source === 'string' ? (await fetch(source)).blob() : source;
}

async function bytesOf(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await blob.arrayBuffer());
}

function extensionOf(type: string): string {
  return EXTENSIONS[type] ?? 'bin';
}

/** A name for the downloaded file: the project's, without what file systems refuse. */
export function exportFileName(project: Project): string {
  const base = project.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
  return `${base}.pixel-perfect.zip`;
}

/** What the user chose to put in the archive, from the export dialog. */
export interface ExportOptions {
  /**
   * Carry each page's saved snapshots. They live apart from the viewport
   * slots, so clearing every capture and Figma export leaves them in place —
   * and they are often the heaviest part of the archive.
   */
  includeHistory: boolean;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = { includeHistory: true };

export async function exportProject(
  project: Project,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<Blob> {
  const files: ZipEntry[] = [];
  /**
   * Write one image under `path`: a single file, or — for a tiled image — a
   * folder of strips numbered top to bottom, each one a file anyone can open.
   */
  const add = async (
    path: string,
    source: Blob | string,
  ): Promise<ImageRef> => {
    const blob = await blobFrom(source);
    const tiled = await unpackTiles(blob);
    if (!tiled) {
      // A data URL whose MIME was lost still opens as the PNG it most likely is
      const type = blob.type || 'image/png';
      const file = `${path}.${extensionOf(type)}`;
      files.push({ name: file, data: await bytesOf(blob) });
      return { file, type };
    }
    const digits = String(tiled.tiles.length).length;
    const strips: StripRef[] = [];
    for (const [i, tile] of tiled.tiles.entries()) {
      const number = String(i + 1).padStart(digits, '0');
      const file = `${path}/${number}.${extensionOf(tiled.mime)}`;
      files.push({ name: file, data: await bytesOf(tile.blob) });
      strips.push({ file, height: tile.height });
    }
    return {
      type: TILES_MIME,
      tiles: {
        width: tiled.width,
        height: tiled.height,
        mime: tiled.mime,
        strips,
      },
    };
  };

  const previews = await loadPreviews(pageIds(project));
  const pages: ManifestPage[] = [];

  for (const [index, page] of project.pages.entries()) {
    const dir = `pages/${index + 1}`;
    const [stored, history, notes] = await Promise.all([
      loadSlots(page.id),
      // Skipped history is never read: no point pulling blobs we will not write
      options.includeHistory ? loadHistory(page.id) : Promise.resolve([]),
      loadNotes(page.id),
    ]);

    const slots: Record<ViewportKey, ManifestSlot> = {};
    for (const [key, slot] of Object.entries(stored)) {
      const name = fileSafe(key);
      const { screenshot, figmaBlob, figmaFileName } = slot;
      slots[key] = {
        screenshot: screenshot
          ? {
              ...(await add(`${dir}/capture-${name}`, screenshot.image)),
              width: screenshot.width,
              height: screenshot.height,
            }
          : null,
        figma: figmaBlob
          ? {
              ...(await add(`${dir}/figma-${name}`, figmaBlob)),
              fileName: figmaFileName ?? 'figma',
            }
          : null,
      };
    }

    const snapshots: ManifestSnapshot[] = [];
    // Oldest first, so the numbering in the archive follows the timeline
    for (const [n, entry] of [...history].reverse().entries()) {
      snapshots.push({
        ...(await add(
          `${dir}/snapshots/${n + 1}-${fileSafe(entry.viewport)}`,
          entry.blob,
        )),
        viewport: entry.viewport,
        fileName: entry.fileName,
        offsetY: entry.offsetY,
        savedAt: entry.savedAt,
      });
    }

    pages.push({
      name: page.name,
      url: page.url,
      // The site password is deliberately left out: a ZIP is passed around,
      // and a store's password should not travel with it
      figmaUrls: page.figmaUrls,
      createdAt: page.createdAt,
      notes,
      preview: previews[page.id] ?? null,
      slots,
      snapshots,
    });
  }

  const manifest: Manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    project: { name: project.name },
    settings: await loadSettings(project.id),
    pages,
  };
  files.unshift({
    name: MANIFEST,
    data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });
  return createZip(files);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** An export opened and checked, nothing written yet. */
export interface ProjectArchive {
  /** The project's name as it will appear in the list. */
  name: string;
  /** Pages in the file. */
  pageCount: number;
  /** Pages past {@link MAX_PAGES} that the import leaves out. */
  droppedPages: number;
  /** @internal what `writeProjectArchive` unpacks */
  manifest: Partial<Manifest>;
  /** @internal the archive's files, by path */
  files: Map<string, Uint8Array<ArrayBuffer>>;
}

/**
 * Open an export and check it is one this version can read. Nothing is
 * written, so the caller can still decide not to import it.
 */
export async function readProjectArchive(file: Blob): Promise<ProjectArchive> {
  const files = await readZip(file);
  const rawManifest = files.get(MANIFEST);
  let manifest: Partial<Manifest> | null = null;
  try {
    if (rawManifest) {
      manifest = JSON.parse(new TextDecoder().decode(rawManifest));
    }
  } catch {
    // reported below, with the same message as a missing one
  }
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    manifest.format !== FORMAT ||
    !Array.isArray(manifest.pages)
  ) {
    throw new Error('This ZIP is not a Pixel Perfect project export');
  }
  if (num(manifest.version) > VERSION) {
    throw new Error('This export comes from a newer version of Pixel Perfect');
  }
  const pageCount = manifest.pages.length;
  return {
    name: sanitizeName(str(manifest.project?.name, 'Imported')),
    pageCount,
    droppedPages: Math.max(0, pageCount - MAX_PAGES),
    manifest,
    files,
  };
}

/**
 * Unpack a checked export into a new project, writing its work to storage
 * first. Only the first {@link MAX_PAGES} pages are kept.
 *
 * The project itself is returned for the caller to add to the list. If any
 * write fails part way, everything already written for it is deleted again
 * before the error is passed on, so a failed import leaves nothing behind.
 */
export async function writeProjectArchive(
  archive: ProjectArchive,
): Promise<Project> {
  const { manifest, files } = archive;

  const fileOf = (file: unknown, type: string): Blob => {
    const data = typeof file === 'string' ? files.get(file) : undefined;
    if (!data) throw new Error(`The export is missing ${str(file, 'a file')}`);
    return new Blob([data], { type });
  };

  /** One image back as one Blob: a file as it is, a folder of strips repacked. */
  const blobOf = (ref: unknown): Blob => {
    const { file, type, tiles } = (ref ?? {}) as Partial<FileRef> &
      Partial<Pick<TiledRef, 'tiles'>>;
    if (!tiles) return fileOf(file, str(type, 'image/png'));
    const mime = str(tiles.mime, 'image/webp');
    const strips = Array.isArray(tiles.strips) ? tiles.strips : [];
    if (strips.length === 0)
      throw new Error('The export has an empty tiled image');
    return packTiles({
      width: num(tiles.width),
      height: num(tiles.height),
      mime,
      tiles: strips.map((strip) => ({
        height: num(strip.height),
        blob: fileOf(strip.file, mime),
      })),
    });
  };

  const project = createProject(archive.name);
  // A malformed entry (null, a number) becomes an empty page rather than a crash
  const rawPages = (manifest.pages ?? [])
    .slice(0, MAX_PAGES)
    .map((raw) =>
      raw && typeof raw === 'object' ? raw : {},
    ) as Partial<ManifestPage>[];
  project.pages = rawPages.map((raw) => ({
    ...createPage(str(raw.name, 'Page'), str(raw.url)),
    sitePassword: str(raw.sitePassword),
    figmaUrls: sanitizeFigmaUrls(raw.figmaUrls),
    createdAt: num(raw.createdAt, Date.now()),
  }));
  if (project.pages.length === 0) project.pages = [createPage('Home')];

  try {
    await saveSettings(project.id, sanitizeSettings(manifest.settings));

    for (const [index, raw] of rawPages.entries()) {
      const pageId = project.pages[index].id;
      if (raw.notes) await saveNotes(pageId, str(raw.notes));
      if (raw.preview) await savePreview(pageId, str(raw.preview));

      for (const [key, slot] of Object.entries(raw.slots ?? {})) {
        if (slot?.screenshot) {
          await saveScreenshot(pageId, key, {
            image: await readAsDataUrl(blobOf(slot.screenshot)),
            width: num(slot.screenshot.width),
            height: num(slot.screenshot.height),
          });
        }
        if (slot?.figma) {
          await saveFigma(
            pageId,
            key,
            blobOf(slot.figma),
            str(slot.figma.fileName, 'figma'),
          );
        }
      }

      for (const snapshot of raw.snapshots ?? []) {
        await saveHistoryEntry({
          projectId: project.id,
          pageId,
          viewport: str(snapshot.viewport),
          blob: blobOf(snapshot),
          fileName: str(snapshot.fileName, 'snapshot'),
          offsetY: num(snapshot.offsetY),
          savedAt: num(snapshot.savedAt, Date.now()),
        });
      }
    }
  } catch (err) {
    // Nothing points at these records yet: drop them, so a half import does
    // not sit in storage for good. A failure here is secondary to `err`.
    await deleteProjectData(project.id, pageIds(project)).catch((cleanup) => {
      console.warn(
        'pixel-perfect: could not clean up a failed import',
        cleanup,
      );
    });
    throw err;
  }

  return project;
}

/** Read and unpack in one go, for callers with nothing to ask in between. */
export async function importProject(file: Blob): Promise<Project> {
  return writeProjectArchive(await readProjectArchive(file));
}
