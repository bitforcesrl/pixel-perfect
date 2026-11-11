import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  clearFigma,
  closeDatabase,
  deleteHistoryEntry,
  loadHistory,
  loadNotes,
  loadProjects,
  loadSlots,
  saveFigma,
  saveHistoryEntry,
  saveNotes,
  saveScreenshot,
} from './storage';
import type { ScreenshotResult } from './validation';
import { LEGACY_PROJECT_ID } from './projects';

/** The page everything below is stored under. */
const P = 'page-a';

const SHOT: ScreenshotResult = {
  image: 'data:image/png;base64,iVBORw0KGgo=',
  width: 375,
  height: 1200,
};

function entry(
  overrides: Partial<Parameters<typeof saveHistoryEntry>[0]> = {},
) {
  return {
    projectId: 'proj-a',
    pageId: P,
    viewport: 'mobile' as const,
    blob: new Blob(['figma-bytes'], { type: 'image/webp' }),
    fileName: 'home.webp',
    offsetY: 0,
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

afterEach(async () => {
  await closeDatabase();
  // A fresh factory is the supported way to reset fake-indexeddb between cases
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

describe('slots', () => {
  it('returns an empty object when nothing was ever saved', async () => {
    await expect(loadSlots(P)).resolves.toEqual({});
  });

  it('round-trips a screenshot', async () => {
    await saveScreenshot(P, 'mobile', SHOT);

    const slots = await loadSlots(P);
    expect(slots.mobile?.screenshot).toEqual(SHOT);
    expect(slots.mobile?.figmaBlob).toBeNull();
  });

  it('round-trips a Figma blob with its file name', async () => {
    await saveFigma(
      P,
      'desktop',
      new Blob(['bytes'], { type: 'image/webp' }),
      'home.webp',
    );

    const slots = await loadSlots(P);
    expect(slots.desktop?.figmaFileName).toBe('home.webp');
    expect(await slots.desktop?.figmaBlob?.text()).toBe('bytes');
  });

  it('saving one layer preserves the other', async () => {
    await saveFigma(P, 'tablet', new Blob(['keep-me']), 'tablet.webp');
    await saveScreenshot(P, 'tablet', SHOT);

    const slots = await loadSlots(P);
    expect(slots.tablet?.screenshot).toEqual(SHOT);
    expect(await slots.tablet?.figmaBlob?.text()).toBe('keep-me');
  });

  it('clearFigma drops only the Figma layer', async () => {
    await saveScreenshot(P, 'mobile', SHOT);
    await saveFigma(P, 'mobile', new Blob(['bye']), 'mobile.webp');

    await clearFigma(P, 'mobile');

    const slots = await loadSlots(P);
    expect(slots.mobile?.screenshot).toEqual(SHOT);
    expect(slots.mobile?.figmaBlob).toBeNull();
    expect(slots.mobile?.figmaFileName).toBeNull();
  });

  it('keeps two pages apart', async () => {
    await saveScreenshot(P, 'mobile', SHOT);

    await expect(loadSlots('page-b')).resolves.toEqual({});
  });
});

describe('history', () => {
  it('starts empty', async () => {
    await expect(loadHistory(P)).resolves.toEqual([]);
  });

  it('round-trips an entry, assigning it an id', async () => {
    await saveHistoryEntry(entry());

    const [saved, ...rest] = await loadHistory(P);
    expect(rest).toEqual([]);
    expect(saved.id).toEqual(expect.any(Number));
    expect(saved.viewport).toBe('mobile');
    expect(saved.fileName).toBe('home.webp');
    expect(saved.offsetY).toBe(0);
    expect(await saved.blob.text()).toBe('figma-bytes');
  });

  it('returns entries newest first, whatever order they were written in', async () => {
    await saveHistoryEntry(entry({ fileName: 'middle.webp', savedAt: 2000 }));
    await saveHistoryEntry(entry({ fileName: 'oldest.webp', savedAt: 1000 }));
    await saveHistoryEntry(entry({ fileName: 'newest.webp', savedAt: 3000 }));

    const names = (await loadHistory(P)).map((e) => e.fileName);
    expect(names).toEqual(['newest.webp', 'middle.webp', 'oldest.webp']);
  });

  it('keeps entries for different viewports side by side', async () => {
    await saveHistoryEntry(entry({ viewport: 'mobile', savedAt: 2000 }));
    await saveHistoryEntry(entry({ viewport: 'desktop', savedAt: 1000 }));

    expect((await loadHistory(P)).map((e) => e.viewport)).toEqual([
      'mobile',
      'desktop',
    ]);
  });

  it('leaves another page out of the list', async () => {
    await saveHistoryEntry(entry());
    await saveHistoryEntry(entry({ pageId: 'page-b', fileName: 'other.webp' }));

    expect((await loadHistory(P)).map((e) => e.fileName)).toEqual([
      'home.webp',
    ]);
  });

  it('deletes one entry and leaves the rest', async () => {
    await saveHistoryEntry(entry({ fileName: 'a.webp', savedAt: 2000 }));
    await saveHistoryEntry(entry({ fileName: 'b.webp', savedAt: 1000 }));

    const doomed = (await loadHistory(P)).find((e) => e.fileName === 'a.webp');
    await deleteHistoryEntry(doomed!.id);

    expect((await loadHistory(P)).map((e) => e.fileName)).toEqual(['b.webp']);
  });
});

describe('notes', () => {
  it('is an empty string until something is written', async () => {
    await expect(loadNotes(P)).resolves.toBe('');
  });

  it('round-trips, and the last write wins', async () => {
    await saveNotes(P, 'hero is 8px low');
    await saveNotes(P, 'hero is 8px low, footer links wrap');

    await expect(loadNotes(P)).resolves.toBe(
      'hero is 8px low, footer links wrap',
    );
  });

  it('is kept per page', async () => {
    await saveNotes(P, 'this page only');

    await expect(loadNotes('page-b')).resolves.toBe('');
  });
});

describe('clearAll', () => {
  it('empties the slots', async () => {
    await saveScreenshot(P, 'mobile', SHOT);

    await clearAll(P);

    await expect(loadSlots(P)).resolves.toEqual({});
  });

  it('leaves the history and the notes alone — they are an archive', async () => {
    await saveScreenshot(P, 'mobile', SHOT);
    await saveHistoryEntry(entry());
    await saveNotes(P, 'keep me');

    await clearAll(P);

    expect(await loadHistory(P)).toHaveLength(1);
    await expect(loadNotes(P)).resolves.toBe('keep me');
  });
});

describe('upgrades', () => {
  it('keeps version 1 slot data and adds the new stores', async () => {
    await closeDatabase();
    // Build the version 1 shape by hand: one store, out-of-line keys
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('pixel-perfect', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('slots');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('slots', 'readwrite');
        tx.objectStore('slots').put(
          { screenshot: SHOT, figmaBlob: null, figmaFileName: null },
          'mobile',
        );
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });

    // Opening at version 2 runs the upgrade; the project list migrates the
    // pre-project records under the default project's one page, which carries
    // the project's own id
    const { projects } = await loadProjects();
    expect(projects.map((p) => p.id)).toEqual([LEGACY_PROJECT_ID]);
    expect(projects[0].pages.map((p) => p.id)).toEqual([LEGACY_PROJECT_ID]);

    const slots = await loadSlots(LEGACY_PROJECT_ID);
    expect(slots.mobile?.screenshot).toEqual(SHOT);
    await expect(loadHistory(LEGACY_PROJECT_ID)).resolves.toEqual([]);
    await expect(loadNotes(LEGACY_PROJECT_ID)).resolves.toBe('');
  });
});

describe('when IndexedDB is unavailable', () => {
  it('resolves instead of throwing, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await closeDatabase();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(loadSlots(P)).resolves.toEqual({});
    await expect(loadHistory(P)).resolves.toEqual([]);
    await expect(loadNotes(P)).resolves.toBe('');
    await expect(saveScreenshot(P, 'mobile', SHOT)).resolves.toBeUndefined();
    await expect(saveHistoryEntry(entry())).resolves.toBeUndefined();
    await expect(deleteHistoryEntry(1)).resolves.toBeUndefined();
    await expect(saveNotes(P, 'x')).resolves.toBeUndefined();
    await expect(clearAll(P)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
