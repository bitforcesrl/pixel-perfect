import { pageIds, type Project } from './projects';
import { deleteProjectData } from './storage';
import { importProject } from './transfer';

/**
 * The demo project — a regular Pixel Perfect export, served from `public/`.
 *
 * To update the demo, export a project from the app (File ▸ Export project as
 * ZIP) and overwrite `public/demo-project.zip`. Nothing else needs to change.
 */
export const DEMO_ZIP_URL = '/demo-project.zip';

/** Where this browser remembers which project came from the demo. */
const DEMO_ID_KEY = 'pixel-perfect:demo-project-id';

function readDemoId(): string | null {
  try {
    return localStorage.getItem(DEMO_ID_KEY);
  } catch {
    return null;
  }
}

function writeDemoId(id: string): void {
  try {
    localStorage.setItem(DEMO_ID_KEY, id);
  } catch {
    // Private mode: the next visit just won't replace this copy
  }
}

/** Forget which project came from the demo — part of "Reset everything". */
export function forgetDemoCopy(): void {
  try {
    localStorage.removeItem(DEMO_ID_KEY);
  } catch {
    // Storage blocked: there is nothing stored to forget either
  }
}

/**
 * One import in flight at a time, however many times React mounts the caller
 * (Strict Mode mounts effects twice in development): a second run would
 * write a second copy of every image to storage. The caller that uses the
 * result calls {@link forgetDemoImport}, so a later visit to /demo in the
 * same page lifetime imports again instead of reusing a project that may
 * since have been edited or deleted.
 */
let pending: Promise<Project> | null = null;

/** The import has been put to use: the next request starts a new one. */
export function forgetDemoImport(): void {
  pending = null;
}

/**
 * The copy of the demo this browser imported on an earlier visit, if it is
 * still in the list. It may hold the visitor's own captures and notes.
 */
export function findDemoCopy(projects: Project[]): Project | null {
  const id = readDemoId();
  return projects.find((project) => project.id === id) ?? null;
}

/** Download the demo ZIP and unpack it into storage, like a manual import. */
export function importDemoProject(
  url: string = DEMO_ZIP_URL,
): Promise<Project> {
  pending ??= (async () => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not download the demo (${res.status})`);
    return importProject(await res.blob());
  })().catch((err) => {
    pending = null; // let a retry try again
    throw err;
  });
  return pending;
}

/**
 * Put a freshly imported demo into the project list.
 *
 * The copy imported on an earlier visit is dropped, with its stored work, so
 * coming back to /demo always shows the current ZIP and never piles up
 * duplicates. The visitor's own projects are left untouched.
 */
export function swapInDemo(projects: Project[], demo: Project): Project[] {
  const previousId = readDemoId();
  const previous = projects.find(
    (project) => project.id === previousId && project.id !== demo.id,
  );
  if (previous) void deleteProjectData(previous.id, pageIds(previous));
  writeDemoId(demo.id);
  return [
    ...projects.filter(
      (project) => project.id !== previous?.id && project.id !== demo.id,
    ),
    demo,
  ];
}
