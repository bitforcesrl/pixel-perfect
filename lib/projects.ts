import type { ViewportKey } from './viewports';

/**
 * A project: one site, its viewport settings, and the pages compared against it.
 *
 * Work is stored one level down, per page: a page owns its URL, its captures,
 * its Figma exports, its snapshots and its notes. The project owns the list and
 * the viewport settings every page is captured at.
 */
export interface Page {
  id: string;
  name: string;
  /** The page this comparison captures — remembered per page. */
  url: string;
  /**
   * What the site's own password gate is answered with, when it has one — a
   * Shopify store still behind its storefront password, a staging site. Empty
   * when the page is public.
   */
  sitePassword: string;
  /**
   * The Figma frame each viewport is compared against, as the link copied out
   * of Figma. Keyed by viewport; a viewport with no entry has no frame yet.
   */
  figmaUrls: Record<ViewportKey, string>;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  pages: Page[];
  createdAt: number;
}

/**
 * The project already in the list that an import named `name` would replace:
 * same name, ignoring case and surrounding spaces. Null when there is none.
 */
export function findProjectByName(
  projects: Project[],
  name: string,
): Project | null {
  const wanted = sanitizeName(name).toLowerCase();
  return (
    projects.find((project) => project.name.toLowerCase() === wanted) ?? null
  );
}

/** The project the pre-project database becomes when it is first migrated. */
export const LEGACY_PROJECT_ID = 'default';

export const MAX_NAME_LENGTH = 60;

/**
 * How many projects one browser keeps. Everything lives in IndexedDB on this
 * machine, so the cap keeps storage, the Projects list and every export at a
 * size the browser handles comfortably. Older databases above it keep what
 * they have; only adding more is refused.
 */
export const MAX_PROJECTS = 6;

/** How many pages one project holds — the same reasoning as {@link MAX_PROJECTS}. */
export const MAX_PAGES = 6;

/** A name the list can render: trimmed, bounded, never blank. */
export function sanitizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return 'Untitled';
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createPage(name: string, url = ''): Page {
  return {
    id: randomId(),
    name: sanitizeName(name),
    url,
    sitePassword: '',
    figmaUrls: {},
    createdAt: Date.now(),
  };
}

/**
 * A new project starts with one empty page and no URL anywhere — every URL is
 * typed in by whoever opens the page.
 */
export function createProject(name: string): Project {
  return {
    id: randomId(),
    name: sanitizeName(name),
    pages: [createPage('Home')],
    createdAt: Date.now(),
  };
}

function sanitizePage(raw: unknown): Page | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, url, sitePassword, figmaUrls, createdAt } =
    raw as Partial<Page>;
  if (typeof id !== 'string' || id.length === 0) return null;
  return {
    id,
    name: sanitizeName(typeof name === 'string' ? name : ''),
    url: typeof url === 'string' ? url : '',
    sitePassword: typeof sitePassword === 'string' ? sitePassword : '',
    figmaUrls: sanitizeFigmaUrls(figmaUrls),
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
  };
}

/** Only string links survive; anything else stored there is dropped. */
export function sanitizeFigmaUrls(raw: unknown): Record<ViewportKey, string> {
  if (typeof raw !== 'object' || raw === null) return {};
  const urls: Record<ViewportKey, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') urls[key] = value;
  }
  return urls;
}

export function sanitizePages(raw: unknown): Page[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const pages: Page[] = [];
  for (const entry of raw) {
    const page = sanitizePage(entry);
    if (!page || seen.has(page.id)) continue;
    seen.add(page.id);
    pages.push(page);
  }
  return pages.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * A record written before pages existed carried one URL and stored its work
 * under the project id. It becomes a single page carrying that same id, so
 * every key it already wrote still resolves.
 */
function sanitizeProject(raw: unknown): Project | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, pages, createdAt, url } = raw as Partial<Project> & {
    url?: unknown;
  };
  if (typeof id !== 'string' || id.length === 0) return null;
  const sanitized = sanitizePages(pages);
  return {
    id,
    name: sanitizeName(typeof name === 'string' ? name : ''),
    pages:
      sanitized.length > 0
        ? sanitized
        : [
            {
              id,
              name: 'Home',
              url: typeof url === 'string' ? url : '',
              sitePassword: '',
              figmaUrls: {},
              createdAt: typeof createdAt === 'number' ? createdAt : 0,
            },
          ],
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
  };
}

/**
 * Whatever the database holds turned into a usable list: unreadable records
 * dropped, duplicate ids collapsed, oldest first so the list order is stable.
 */
export function sanitizeProjects(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const projects: Project[] = [];
  for (const entry of raw) {
    const project = sanitizeProject(entry);
    if (!project || seen.has(project.id)) continue;
    seen.add(project.id);
    projects.push(project);
  }
  return projects.sort((a, b) => a.createdAt - b.createdAt);
}

/** The project to open: the stored choice while it still exists, else the first. */
export function resolveActive(
  projects: Project[],
  storedId: unknown,
): Project | null {
  if (projects.length === 0) return null;
  const stored =
    typeof storedId === 'string'
      ? projects.find((project) => project.id === storedId)
      : undefined;
  return stored ?? projects[0];
}

/** The page to open within a project, on the same terms. */
export function resolveActivePage(
  pages: Page[],
  storedId: unknown,
): Page | null {
  if (pages.length === 0) return null;
  const stored =
    typeof storedId === 'string'
      ? pages.find((page) => page.id === storedId)
      : undefined;
  return stored ?? pages[0];
}

/** Every page id in the project — what its stored work is keyed by. */
export function pageIds(project: Project): string[] {
  return project.pages.map((page) => page.id);
}
