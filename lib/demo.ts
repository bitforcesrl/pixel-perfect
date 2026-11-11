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

/**
 * One import per page load, however many times React mounts the caller
 * (Strict Mode mounts effects twice in development): a second run would
 * write a second copy of every image to storage.
 */
let pending: Promise<Project> | null = null;

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
