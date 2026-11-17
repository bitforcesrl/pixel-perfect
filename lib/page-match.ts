import {
  createPage,
  createProject,
  MAX_PAGES,
  MAX_PROJECTS,
  type Project,
} from './projects';

/**
 * Which pages a site address belongs to — how a page sent from the browser
 * extension ("Open in Pixel Perfect") finds the page that already compares it.
 *
 * Two addresses are the same page when they share origin and path: the query
 * (tracking, variants) and the hash do not make another page, nor does a
 * trailing slash. The host is case-insensitive; the path is not, since a
 * server may treat `/About` and `/about` as different pages.
 */
export function normalizePageUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

export interface PageRef {
  projectId: string;
  pageId: string;
}

/** Every page, in every project, whose address is `url`. */
export function findPagesByUrl(projects: Project[], url: string): PageRef[] {
  const wanted = normalizePageUrl(url);
  if (wanted === null) return [];
  const found: PageRef[] = [];
  for (const project of projects) {
    for (const page of project.pages) {
      if (page.url && normalizePageUrl(page.url) === wanted) {
        found.push({ projectId: project.id, pageId: page.id });
      }
    }
  }
  return found;
}

/** Where a site sent from the extension goes, as chosen in the dialog. */
export type IncomingChoice =
  | { kind: 'page'; projectId: string; pageId: string }
  | { kind: 'new'; projectId: string; name: string }
  | { kind: 'new-project'; name: string };

/**
 * The project list with the site placed, and the page to open; null when the
 * choice cannot be honoured (a project or page cap reached, an id gone).
 */
export function placeIncoming(
  projects: Project[],
  url: string,
  choice: IncomingChoice,
): { projects: Project[]; projectId: string; pageId: string } | null {
  if (choice.kind === 'page') {
    const project = projects.find((entry) => entry.id === choice.projectId);
    if (!project?.pages.some((page) => page.id === choice.pageId)) return null;
    return { projects, projectId: choice.projectId, pageId: choice.pageId };
  }
  if (choice.kind === 'new') {
    const project = projects.find((entry) => entry.id === choice.projectId);
    if (!project || project.pages.length >= MAX_PAGES) return null;
    const page = createPage(choice.name, url);
    return {
      projects: projects.map((entry) =>
        entry.id === project.id
          ? { ...entry, pages: [...entry.pages, page] }
          : entry,
      ),
      projectId: project.id,
      pageId: page.id,
    };
  }
  if (projects.length >= MAX_PROJECTS) return null;
  const base = createProject(choice.name);
  const project = { ...base, pages: [{ ...base.pages[0], url }] };
  return {
    projects: [...projects, project],
    projectId: project.id,
    pageId: project.pages[0].id,
  };
}
