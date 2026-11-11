import type { ScreenshotResult } from './validation';
import { VIEWPORT_KEYS, type ViewportKey } from './viewports';
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type ViewportSettings,
} from './settings';
import {
  LEGACY_PROJECT_ID,
  resolveActive,
  sanitizeProjects,
  type Project,
} from './projects';

const DB_NAME = 'pixel-perfect';
const DB_VERSION = 2;
const STORE = 'slots';
const HISTORY = 'history';
const META = 'meta';
const NOTES_KEY = 'notes';
const PREVIEW_KEY = 'preview';
const SETTINGS_KEY = 'viewportSettings';
const PASSWORD_KEY = 'sitePassword';
const PROJECTS_KEY = 'projects';
const ACTIVE_PROJECT_KEY = 'activeProject';
const ACTIVE_PAGE_KEY = 'activePage';

/**
 * Captures, exports, snapshots and notes are stored under a key carrying the
 * page's id; viewport settings under the project's. One database holds every
 * page side by side, and deleting one is a matter of dropping its keys.
 *
 * A project written before pages existed keeps working because the page it is
 * migrated into carries the project's own id — the keys already on disk are the
 * keys these functions build.
 */
function slotKey(pageId: string, viewport: ViewportKey): string {
  return `${pageId}::${viewport}`;
}

/** Every slot key of one page, whichever viewports it has held. */
function pageSlots(pageId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${pageId}::`, `${pageId}::\uffff`);
}

/** The viewport a slot key belongs to. */
function slotViewport(pageId: string, id: IDBValidKey): ViewportKey {
  return String(id).slice(`${pageId}::`.length);
}

function notesKey(pageId: string): string {
  return `${NOTES_KEY}::${pageId}`;
}

function previewKey(pageId: string): string {
  return `${PREVIEW_KEY}::${pageId}`;
}

function settingsKey(projectId: string): string {
  return `${SETTINGS_KEY}::${projectId}`;
}

function activePageKey(projectId: string): string {
  return `${ACTIVE_PAGE_KEY}::${projectId}`;
}

/** One viewport's persisted layers. Everything else is view state, and volatile. */
export interface StoredSlot {
  screenshot: ScreenshotResult | null;
  figmaBlob: Blob | null;
  figmaFileName: string | null;
}

const EMPTY_SLOT: StoredSlot = {
  screenshot: null,
  figmaBlob: null,
  figmaFileName: null,
};

let dbPromise: Promise<IDBDatabase> | null = null;
let warned = false;

/** Persistence is a convenience — one warning, then carry on in memory. */
function warnOnce(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(
    'pixel-perfect: local storage unavailable, continuing in memory',
    err,
  );
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // `contains` checks rather than a version switch: a version 1 database
        // keeps its slot records and only gains what is missing
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(HISTORY)) {
          const history = db.createObjectStore(HISTORY, {
            keyPath: 'id',
            autoIncrement: true,
          });
          // Unused by the current reads, which list every viewport at once —
          // created now because adding an index later costs another version
          history.createIndex('viewport', 'viewport');
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
    });
    // Let a later call retry a failed open, and keep the rejection handled
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Run `fill` inside one transaction, resolving only once it commits. */
async function transact(
  storeName: string | string[],
  mode: IDBTransactionMode,
  fill: (tx: IDBTransaction) => void,
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    fill(tx);
  });
}

/** The common case: one store, one transaction. */
function withStore(
  storeName: string,
  mode: IDBTransactionMode,
  fill: (store: IDBObjectStore) => void,
): Promise<void> {
  return transact(storeName, mode, (tx) => fill(tx.objectStore(storeName)));
}

/** Merge into a viewport's record, so writing one layer never drops the other. */
async function patchSlot(
  pageId: string,
  key: ViewportKey,
  patch: Partial<StoredSlot>,
): Promise<void> {
  await withStore(STORE, 'readwrite', (store) => {
    const id = slotKey(pageId, key);
    const request = store.get(id);
    request.onsuccess = () => {
      const current = (request.result as StoredSlot | undefined) ?? EMPTY_SLOT;
      store.put({ ...current, ...patch }, id);
    };
  });
}

async function swallow(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    warnOnce(err);
  }
}

export async function loadSlots(
  pageId: string,
): Promise<Record<ViewportKey, StoredSlot>> {
  const slots: Record<ViewportKey, StoredSlot> = {};
  await swallow(() =>
    withStore(STORE, 'readonly', (store) => {
      const request = store.openCursor(pageSlots(pageId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        slots[slotViewport(pageId, cursor.key)] = cursor.value as StoredSlot;
        cursor.continue();
      };
    }),
  );
  return slots;
}

export function saveScreenshot(
  pageId: string,
  key: ViewportKey,
  screenshot: ScreenshotResult,
): Promise<void> {
  return swallow(() => patchSlot(pageId, key, { screenshot }));
}

export function saveFigma(
  pageId: string,
  key: ViewportKey,
  blob: Blob,
  fileName: string,
): Promise<void> {
  return swallow(() =>
    patchSlot(pageId, key, { figmaBlob: blob, figmaFileName: fileName }),
  );
}

export function clearFigma(pageId: string, key: ViewportKey): Promise<void> {
  return swallow(() =>
    patchSlot(pageId, key, { figmaBlob: null, figmaFileName: null }),
  );
}

export function clearScreenshot(
  pageId: string,
  key: ViewportKey,
): Promise<void> {
  return swallow(() => patchSlot(pageId, key, { screenshot: null }));
}

/** Drop one page's captures and uploads, leaving every other page untouched. */
export function clearAll(pageId: string): Promise<void> {
  return swallow(() =>
    withStore(STORE, 'readwrite', (store) => {
      store.delete(pageSlots(pageId));
    }),
  );
}

/** Drop one viewport's layers from every page that held them. */
export function clearViewport(
  pageIds: string[],
  key: ViewportKey,
): Promise<void> {
  return swallow(() =>
    withStore(STORE, 'readwrite', (store) => {
      for (const pageId of pageIds) store.delete(slotKey(pageId, key));
    }),
  );
}

/** One archived Figma export, restorable into the viewport it came from. */
export interface HistoryEntry {
  id: number;
  projectId: string;
  /**
   * Missing on entries archived before pages existed: those belong to the page
   * that carries the project's id, which is what the fallback below resolves to.
   */
  pageId?: string;
  viewport: ViewportKey;
  blob: Blob;
  fileName: string;
  offsetY: number;
  savedAt: number;
}

/** The page an archived entry belongs to. */
function entryPage(entry: HistoryEntry): string {
  return entry.pageId ?? entry.projectId;
}

/** Stamped with the time it is stored unless the entry already says when. */
export function saveHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'savedAt'> & { savedAt?: number },
): Promise<void> {
  return swallow(() =>
    withStore(HISTORY, 'readwrite', (store) => {
      store.add({ ...entry, savedAt: entry.savedAt ?? Date.now() });
    }),
  );
}

/** One page's archive, newest first, so the list reads top-down as a timeline. */
export async function loadHistory(pageId: string): Promise<HistoryEntry[]> {
  let entries: HistoryEntry[] = [];
  await swallow(() =>
    withStore(HISTORY, 'readonly', (store) => {
      const request = store.getAll();
      request.onsuccess = () => {
        entries = (request.result as HistoryEntry[]).filter(
          (entry) => entryPage(entry) === pageId,
        );
      };
    }),
  );
  return entries.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Rename an archived export.
 *
 * The name starts as the file's own, which says what was exported but nothing
 * about why it was kept. Renaming is how a snapshot becomes "before the header
 * fix" — read-modify-write in one transaction so the blob rides along.
 */
export function renameHistoryEntry(id: number, name: string): Promise<void> {
  return swallow(() =>
    withStore(HISTORY, 'readwrite', (store) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const entry = request.result as HistoryEntry | undefined;
        if (entry) store.put({ ...entry, fileName: name });
      };
    }),
  );
}

export function deleteHistoryEntry(id: number): Promise<void> {
  return swallow(() =>
    withStore(HISTORY, 'readwrite', (store) => {
      store.delete(id);
    }),
  );
}

export function saveNotes(pageId: string, text: string): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(text, notesKey(pageId));
    }),
  );
}

export async function loadNotes(pageId: string): Promise<string> {
  let notes = '';
  await swallow(() =>
    withStore(META, 'readonly', (store) => {
      const request = store.get(notesKey(pageId));
      request.onsuccess = () => {
        if (typeof request.result === 'string') notes = request.result;
      };
    }),
  );
  return notes;
}

/**
 * A page's thumbnail: a small data URL of what it last captured, stored apart
 * from the capture itself so the gallery can show every page at once without
 * pulling full-page screenshots into memory.
 */
export function savePreview(pageId: string, dataUrl: string): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(dataUrl, previewKey(pageId));
    }),
  );
}

export async function loadPreviews(
  ids: string[],
): Promise<Record<string, string>> {
  const previews: Record<string, string> = {};
  if (ids.length === 0) return previews;
  await swallow(() =>
    withStore(META, 'readonly', (store) => {
      for (const id of ids) {
        const request = store.get(previewKey(id));
        request.onsuccess = () => {
          if (typeof request.result === 'string') previews[id] = request.result;
        };
      }
    }),
  );
  return previews;
}

export function saveSettings(
  projectId: string,
  settings: ViewportSettings,
): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(settings, settingsKey(projectId));
    }),
  );
}

export async function loadSettings(
  projectId: string,
): Promise<ViewportSettings> {
  let settings: ViewportSettings = DEFAULT_SETTINGS;
  await swallow(() =>
    withStore(META, 'readonly', (store) => {
      const request = store.get(settingsKey(projectId));
      request.onsuccess = () => {
        settings = sanitizeSettings(request.result);
      };
    }),
  );
  return settings;
}

/** Which page of a project was open last, so returning lands where you left. */
export function saveActivePage(
  projectId: string,
  pageId: string,
): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(pageId, activePageKey(projectId));
    }),
  );
}

export async function loadActivePage(
  projectId: string,
): Promise<string | null> {
  let pageId: string | null = null;
  await swallow(() =>
    withStore(META, 'readonly', (store) => {
      const request = store.get(activePageKey(projectId));
      request.onsuccess = () => {
        if (typeof request.result === 'string') pageId = request.result;
      };
    }),
  );
  return pageId;
}

/**
 * The site password, as accepted by the server once. It sits next to the rest
 * of this browser's working state — being able to read it back is the point:
 * it is what lets the app open again on the next visit without asking. Shared
 * by every project: the gate is the deployment's, not a project's.
 */
export function savePassword(password: string): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(password, PASSWORD_KEY);
    }),
  );
}

export async function loadPassword(): Promise<string | null> {
  let password: string | null = null;
  await swallow(() =>
    withStore(META, 'readonly', (store) => {
      const request = store.get(PASSWORD_KEY);
      request.onsuccess = () => {
        if (typeof request.result === 'string') password = request.result;
      };
    }),
  );
  return password;
}

export function clearPassword(): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.delete(PASSWORD_KEY);
    }),
  );
}

/**
 * Move a pre-project database under {@link LEGACY_PROJECT_ID}.
 *
 * Runs inside the caller's transaction, and only when no project list exists —
 * the presence of that list is what marks the database as migrated. Records are
 * re-keyed rather than copied, so nothing is duplicated and a database that was
 * already empty simply produces an empty project.
 */
function migrateLegacy(tx: IDBTransaction): void {
  const slots = tx.objectStore(STORE);
  for (const key of VIEWPORT_KEYS) {
    const request = slots.get(key);
    request.onsuccess = () => {
      const record = request.result as StoredSlot | undefined;
      if (!record) return;
      slots.put(record, slotKey(LEGACY_PROJECT_ID, key));
      slots.delete(key);
    };
  }

  const meta = tx.objectStore(META);
  for (const [from, to] of [
    [NOTES_KEY, notesKey(LEGACY_PROJECT_ID)],
    [SETTINGS_KEY, settingsKey(LEGACY_PROJECT_ID)],
  ]) {
    const request = meta.get(from);
    request.onsuccess = () => {
      if (request.result === undefined) return;
      meta.put(request.result, to);
      meta.delete(from);
    };
  }

  const history = tx.objectStore(HISTORY);
  const entries = history.getAll();
  entries.onsuccess = () => {
    for (const entry of entries.result as HistoryEntry[]) {
      if (entry.projectId) continue;
      history.put({ ...entry, projectId: LEGACY_PROJECT_ID });
    }
  };
}

/**
 * The project every database starts from: one page, and no URL anywhere — the
 * URL is typed in per page. Its page carries the project's id so a pre-project
 * database's records land inside it.
 */
function defaultProject(): Project {
  const createdAt = Date.now();
  return {
    id: LEGACY_PROJECT_ID,
    name: 'Default',
    pages: [
      {
        id: LEGACY_PROJECT_ID,
        name: 'Home',
        url: '',
        sitePassword: '',
        figmaUrls: {},
        createdAt,
      },
    ],
    createdAt,
  };
}

/**
 * The project list, creating it if this is the first run.
 *
 * A database that predates projects is migrated whole into one project named
 * after nothing in particular; a fresh one gets that same project empty. Either
 * way the app always has somewhere to put its work.
 */
export async function loadProjects(): Promise<{
  projects: Project[];
  active: Project | null;
}> {
  let projects: Project[] = [];
  let active: Project | null = null;

  await swallow(() =>
    transact([STORE, HISTORY, META], 'readwrite', (tx) => {
      const meta = tx.objectStore(META);
      const stored = meta.get(PROJECTS_KEY);
      stored.onsuccess = () => {
        projects = sanitizeProjects(stored.result);
        if (projects.length === 0) {
          projects = [defaultProject()];
          if (stored.result === undefined) migrateLegacy(tx);
          meta.put(projects, PROJECTS_KEY);
        }
        const chosen = meta.get(ACTIVE_PROJECT_KEY);
        chosen.onsuccess = () => {
          active = resolveActive(projects, chosen.result);
        };
      };
    }),
  );

  // A failed transaction still needs to leave the app somewhere to work
  if (projects.length === 0) projects = [defaultProject()];
  return { projects, active: active ?? projects[0] };
}

export function saveProjects(projects: Project[]): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(projects, PROJECTS_KEY);
    }),
  );
}

export function saveActiveProject(projectId: string): Promise<void> {
  return swallow(() =>
    withStore(META, 'readwrite', (store) => {
      store.put(projectId, ACTIVE_PROJECT_KEY);
    }),
  );
}

/** Every trace of one page: slots, archive, notes, preview. */
export function deletePageData(pageId: string): Promise<void> {
  return swallow(() =>
    transact([STORE, HISTORY, META], 'readwrite', (tx) => {
      const slots = tx.objectStore(STORE);
      slots.delete(pageSlots(pageId));

      const meta = tx.objectStore(META);
      meta.delete(notesKey(pageId));
      meta.delete(previewKey(pageId));

      const history = tx.objectStore(HISTORY);
      const entries = history.getAll();
      entries.onsuccess = () => {
        for (const entry of entries.result as HistoryEntry[]) {
          if (entryPage(entry) === pageId) history.delete(entry.id);
        }
      };
    }),
  );
}

/** Every trace of one project: each of its pages, its settings, its archive. */
export function deleteProjectData(
  projectId: string,
  pages: string[],
): Promise<void> {
  return swallow(() =>
    transact([STORE, HISTORY, META], 'readwrite', (tx) => {
      const slots = tx.objectStore(STORE);
      const meta = tx.objectStore(META);
      for (const pageId of pages) {
        slots.delete(pageSlots(pageId));
        meta.delete(notesKey(pageId));
        meta.delete(previewKey(pageId));
      }
      meta.delete(settingsKey(projectId));
      meta.delete(activePageKey(projectId));

      const history = tx.objectStore(HISTORY);
      const entries = history.getAll();
      entries.onsuccess = () => {
        for (const entry of entries.result as HistoryEntry[]) {
          if (entry.projectId === projectId) history.delete(entry.id);
        }
      };
    }),
  );
}

/**
 * Drop the whole database — every project, page, capture, export, snapshot and
 * note this browser holds, plus the stored site password.
 *
 * Nothing here is recoverable and nothing of it lives on a server, so the
 * caller is expected to have asked twice. The connection is closed first:
 * an open one makes the delete block until the tab goes away, which would
 * leave the app running against a database that is about to vanish. Reload
 * after this resolves — every hydration effect has read from what is now gone.
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Another tab is holding the database open. It is gone as far as this tab
    // is concerned once it closes, and the reload below starts clean either
    // way, so this resolves rather than hanging on a tab we cannot reach.
    request.onblocked = () => resolve();
  });
}

/** Drop the cached connection. */
export async function closeDatabase(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  warned = false;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // an open that never succeeded has nothing to close
  }
}
