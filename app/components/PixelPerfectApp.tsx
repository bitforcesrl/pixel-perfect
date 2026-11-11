'use client';

import { useEffect, useRef, useState } from 'react';
import FirstPageDialog from './FirstPageDialog';
import RegistrationMark from './RegistrationMark';
import Workspace from './Workspace';
import {
  createPage,
  createProject,
  pageIds,
  resolveActivePage,
  sanitizeName,
  type Page,
  type Project,
} from '@/lib/projects';
import {
  deletePageData,
  deleteProjectData,
  loadActivePage,
  loadProjects,
  saveActivePage,
  saveActiveProject,
  saveProjects,
} from '@/lib/storage';
import type { ViewportKey } from '@/lib/viewports';

/**
 * The project and page layer.
 *
 * It owns the list, which project is open and which of its pages, and nothing
 * else: the workspace below is mounted keyed by page id, so opening another
 * page remounts it and every capture, export, snapshot and note is re-read
 * under the new namespace.
 */
export default function PixelPerfectApp() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  // The project just created, waiting to be told what its one page is
  const [pendingFirstPage, setPendingFirstPage] = useState<{
    projectId: string;
    pageId: string;
    projectName: string;
    pageName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { projects: stored, active } = await loadProjects();
      const project = active ?? stored[0] ?? null;
      // Read before the first paint, so the app opens on the page it was left
      // on rather than jumping to it a moment later
      const storedPage = project ? await loadActivePage(project.id) : null;
      if (cancelled) return;
      setProjects(stored);
      setActiveId(project?.id ?? null);
      setActivePageId(
        project
          ? (resolveActivePage(project.pages, storedPage)?.id ?? null)
          : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the list on change, past hydration. A page's URL edits as you type,
  // so this debounces rather than writing per keystroke.
  const savedRef = useRef<Project[] | null>(null);
  useEffect(() => {
    if (projects.length === 0) return;
    if (savedRef.current === null) {
      savedRef.current = projects;
      return;
    }
    if (savedRef.current === projects) return;
    const timer = setTimeout(() => {
      savedRef.current = projects;
      void saveProjects(projects);
    }, 400);
    return () => clearTimeout(timer);
  }, [projects]);

  const active = projects.find((project) => project.id === activeId) ?? null;
  const activePage =
    active?.pages.find((page) => page.id === activePageId) ??
    active?.pages[0] ??
    null;

  /** Rewrite the open project's page list, leaving every other project alone. */
  const patchPages = (map: (pages: Page[]) => Page[]) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeId
          ? { ...project, pages: map(project.pages) }
          : project,
      ),
    );
  };

  const selectProject = async (id: string) => {
    if (id === activeId) return;
    const project = projects.find((entry) => entry.id === id);
    if (!project) return;
    // The stored page is read before the switch, so the workspace mounts once,
    // already on the page this project was last left on
    const stored = await loadActivePage(id);
    setActiveId(id);
    setActivePageId(resolveActivePage(project.pages, stored)?.id ?? null);
    void saveActiveProject(id);
  };

  /** A new project opens straight away — it is empty, there is nothing to lose. */
  const handleCreateProject = (name: string) => {
    const project = createProject(name);
    setProjects((prev) => [...prev, project]);
    setActiveId(project.id);
    setActivePageId(project.pages[0].id);
    void saveActiveProject(project.id);
    void saveActivePage(project.id, project.pages[0].id);
    // A project with no URL anywhere can capture nothing, so the page it opens
    // on is asked for here rather than left as a blank "Home"
    setPendingFirstPage({
      projectId: project.id,
      pageId: project.pages[0].id,
      projectName: project.name,
      pageName: project.pages[0].name,
    });
  };

  /** Names the project's first page and gives it the URL it captures. */
  const completeFirstPage = (name: string, url: string) => {
    if (!pendingFirstPage) return;
    const { projectId, pageId } = pendingFirstPage;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              pages: project.pages.map((page) =>
                page.id === pageId
                  ? { ...page, name: sanitizeName(name), url }
                  : page,
              ),
            }
          : project,
      ),
    );
  };

  const handleRenameProject = (id: string, name: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id ? { ...project, name: sanitizeName(name) } : project,
      ),
    );
  };

  /**
   * Deleting takes the project's stored work with it — every page of it. The
   * last project stays: an empty list would leave the app with nowhere to put
   * anything.
   */
  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const doomed = projects.find((project) => project.id === id);
    const remaining = projects.filter((project) => project.id !== id);
    setProjects(remaining);
    if (id === activeId) {
      const next = remaining[0];
      setActiveId(next.id);
      setActivePageId(next.pages[0]?.id ?? null);
      void saveActiveProject(next.id);
    }
    // Written straight through: the debounce above must not be what stands
    // between a delete and the record of it
    void saveProjects(remaining);
    savedRef.current = remaining;
    if (doomed) void deleteProjectData(id, pageIds(doomed));
  };

  /**
   * An imported project arrives with its work already in storage — only the
   * list is missing it. Written straight through like a delete, then opened.
   */
  const handleImportProject = (project: Project) => {
    const next = [...projects, project];
    setProjects(next);
    void saveProjects(next);
    savedRef.current = next;
    setActiveId(project.id);
    setActivePageId(project.pages[0].id);
    void saveActiveProject(project.id);
    void saveActivePage(project.id, project.pages[0].id);
  };

  const selectPage = (pageId: string) => {
    if (!activeId || pageId === activePageId) return;
    setActivePageId(pageId);
    void saveActivePage(activeId, pageId);
  };

  const handleCreatePage = (name: string, url: string) => {
    if (!activeId) return;
    const page = createPage(name, url);
    patchPages((pages) => [...pages, page]);
    setActivePageId(page.id);
    void saveActivePage(activeId, page.id);
  };

  const handleRenamePage = (pageId: string, name: string) => {
    patchPages((pages) =>
      pages.map((page) =>
        page.id === pageId ? { ...page, name: sanitizeName(name) } : page,
      ),
    );
  };

  /** The last page of a project stays — the workspace has to point somewhere. */
  const handleDeletePage = (pageId: string) => {
    if (!active || active.pages.length <= 1) return;
    const remaining = active.pages.filter((page) => page.id !== pageId);
    patchPages(() => remaining);
    if (pageId === activePageId) {
      setActivePageId(remaining[0].id);
      void saveActivePage(active.id, remaining[0].id);
    }
    void deletePageData(pageId);
  };

  /** Defaults to the open page, so the Screenshot panel needs no page id. */
  const handleUrlChange = (url: string, pageId = activePageId) => {
    if (!pageId) return;
    patchPages((pages) =>
      pages.map((page) => (page.id === pageId ? { ...page, url } : page)),
    );
  };

  const handleSitePasswordChange = (sitePassword: string, pageId: string) => {
    patchPages((pages) =>
      pages.map((page) =>
        page.id === pageId ? { ...page, sitePassword } : page,
      ),
    );
  };

  const handleFigmaUrlChange = (
    key: ViewportKey,
    url: string,
    pageId: string,
  ) => {
    patchPages((pages) =>
      pages.map((page) =>
        page.id === pageId
          ? { ...page, figmaUrls: { ...page.figmaUrls, [key]: url } }
          : page,
      ),
    );
  };

  if (!active || !activePage) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-ink-void">
        <RegistrationMark size={64} className="text-ink-800" />
      </div>
    );
  }

  return (
    <>
      <Workspace
        key={activePage.id}
        project={active}
        page={activePage}
        projects={projects}
        onSelectProject={selectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onImportProject={handleImportProject}
        onSelectPage={selectPage}
        onCreatePage={handleCreatePage}
        onRenamePage={handleRenamePage}
        onDeletePage={handleDeletePage}
        onUrlChange={handleUrlChange}
        onSitePasswordChange={handleSitePasswordChange}
        onFigmaUrlChange={handleFigmaUrlChange}
      />

      {/* Lives here, not in the workspace: the workspace remounts on the new
          project's page, which would take the dialog down with it */}
      <FirstPageDialog
        open={pendingFirstPage !== null}
        projectName={pendingFirstPage?.projectName ?? ''}
        defaultName={pendingFirstPage?.pageName ?? ''}
        onSubmit={completeFirstPage}
        onClose={() => setPendingFirstPage(null)}
      />
    </>
  );
}
