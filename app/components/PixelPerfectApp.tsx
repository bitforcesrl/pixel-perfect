'use client';

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import FirstPageDialog from './FirstPageDialog';
import RegistrationMark from './RegistrationMark';
import Workspace from './Workspace';
import {
  createPage,
  createProject,
  MAX_PAGES,
  MAX_PROJECTS,
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
import {
  findDemoCopy,
  forgetDemoImport,
  importDemoProject,
  swapInDemo,
} from '@/lib/demo';

/**
 * The project and page layer.
 *
 * It owns the list, which project is open and which of its pages, and nothing
 * else: the workspace below is mounted keyed by page id, so opening another
 * page remounts it and every capture, export, snapshot and note is re-read
 * under the new namespace.
 *
 * With `demoUrl` (the /demo route) it first imports that ZIP, exactly like
 * File ▸ Import project from ZIP, and opens on it. A visitor who already has
 * a copy of the demo is asked first: their copy may hold their own captures
 * and notes, and a fresh import would replace it.
 */
export default function PixelPerfectApp({
  demoUrl,
}: {
  /** A project export to import and open before anything else. */
  demoUrl?: string;
} = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  // The project just created, waiting to be told what its one page is
  // The list as last written, so the debounced save can tell a real edit
  // from hydration; and the list as last rendered, for handlers that finish
  // after an await and must not act on the list they started with
  const savedRef = useRef<Project[] | null>(null);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  const [pendingFirstPage, setPendingFirstPage] = useState<{
    projectId: string;
    pageId: string;
    projectName: string;
    pageName: string;
  } | null>(null);
  // Only the demo route ever sets these
  const [demoState, setDemoState] = useState<
    'loading' | 'choose' | 'ready' | 'failed'
  >(demoUrl ? 'loading' : 'ready');
  const [demoError, setDemoError] = useState<string | null>(null);
  // The demo copy this browser already has, while the visitor decides whether
  // to open it as it is or start over from the published ZIP
  const [existingDemo, setExistingDemo] = useState<Project | null>(null);

  /** Open `project` on the page it was last left on. */
  const openProject = async (list: Project[], project: Project | null) => {
    // Read before the first paint, so the app opens on the page it was left
    // on rather than jumping to it a moment later
    const storedPage = project ? await loadActivePage(project.id) : null;
    setProjects(list);
    setActiveId(project?.id ?? null);
    setActivePageId(
      project
        ? (resolveActivePage(project.pages, storedPage)?.id ?? null)
        : null,
    );
  };

  /**
   * Import the published demo, put it in place of any older copy, and open
   * it. `isCancelled` lets the mount effect drop a run React already threw
   * away (Strict Mode mounts twice) before it writes anything.
   */
  const loadFreshDemo = async (
    url: string,
    stored: Project[],
    isCancelled: () => boolean = () => false,
  ) => {
    setDemoState('loading');
    try {
      // Unpacked into storage first; only then does the list learn of it,
      // the same order a manual import follows
      const demo = await importDemoProject(url);
      if (isCancelled()) return;
      forgetDemoImport();
      const list = swapInDemo(stored, demo);
      await saveProjects(list);
      await saveActiveProject(demo.id);
      await saveActivePage(demo.id, demo.pages[0].id);
      savedRef.current = list;
      // From here on it is the visitor's own copy: a reload must not
      // import it again, so the address becomes the plain app's
      window.history.replaceState(null, '', '/app');
      await openProject(list, demo);
      setDemoState('ready');
    } catch (err) {
      if (isCancelled()) return;
      setDemoError(
        err instanceof Error ? err.message : 'The demo could not be loaded',
      );
      setDemoState('failed');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      const { projects: stored, active } = await loadProjects();
      if (cancelled) return;

      if (demoUrl) {
        const copy = findDemoCopy(stored);
        if (copy) {
          // Their copy may carry their own work: ask before replacing it
          setProjects(stored);
          savedRef.current = stored;
          setExistingDemo(copy);
          setDemoState('choose');
          return;
        }
        if (stored.length >= MAX_PROJECTS) {
          setDemoError(
            `This browser already holds ${MAX_PROJECTS} projects, the most it keeps. Delete one in the app, then open the demo again.`,
          );
          setDemoState('failed');
          return;
        }
        await loadFreshDemo(demoUrl, stored, isCancelled);
        return;
      }

      await openProject(stored, active ?? stored[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // loadFreshDemo and openProject only touch state setters and refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoUrl]);

  /** "Open my copy": the demo as the visitor left it, nothing imported. */
  const keepExistingDemo = () => {
    const copy = existingDemo;
    setExistingDemo(null);
    window.history.replaceState(null, '', '/app');
    void (async () => {
      await saveActiveProject(copy?.id ?? '');
      await openProject(projects, copy);
      setDemoState('ready');
    })();
  };

  /** "Start over": a fresh copy of the published demo replaces theirs. */
  const replaceExistingDemo = () => {
    setExistingDemo(null);
    if (demoUrl) void loadFreshDemo(demoUrl, projects);
  };

  // Persist the list on change, past hydration. A page's URL edits as you type,
  // so this debounces rather than writing per keystroke.
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
    // The menus and the Projects list already refuse past the cap; this is
    // the last word, for a call that slips past them
    if (projectsRef.current.length >= MAX_PROJECTS) return;
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
   *
   * With `replacesId` it takes that project's place in the list (the user
   * confirmed replacing a project of the same name), and the old project's
   * stored work is deleted. The list is read from the ref, not from this
   * render: the import ran for a while, and anything changed meanwhile —
   * a page added, a project deleted — must survive it.
   */
  const handleImportProject = (
    project: Project,
    replacesId: string | null = null,
  ) => {
    const current = projectsRef.current;
    const replaced = replacesId
      ? (current.find((entry) => entry.id === replacesId) ?? null)
      : null;
    const next = replaced
      ? current.map((entry) => (entry.id === replaced.id ? project : entry))
      : [...current, project];
    setProjects(next);
    void saveProjects(next);
    savedRef.current = next;
    setActiveId(project.id);
    setActivePageId(project.pages[0].id);
    void saveActiveProject(project.id);
    void saveActivePage(project.id, project.pages[0].id);
    if (replaced) void deleteProjectData(replaced.id, pageIds(replaced));
  };

  const selectPage = (pageId: string) => {
    if (!activeId || pageId === activePageId) return;
    setActivePageId(pageId);
    void saveActivePage(activeId, pageId);
  };

  const handleCreatePage = (name: string, url: string) => {
    if (!activeId || !active || active.pages.length >= MAX_PAGES) return;
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

  if (demoState === 'failed') {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 bg-ink-void p-6 text-center">
        <RegistrationMark size={56} className="text-ink-700" />
        <p className="text-sm text-ink-200">
          The demo project could not be loaded.
        </p>
        <p className="font-mono text-xs text-ink-500">{demoError}</p>
        <a
          href="/app"
          className="rounded bg-press-violet px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-press-violet/85"
        >
          Open the app without it
        </a>
      </div>
    );
  }

  if (demoState === 'choose') {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-ink-void">
        <RegistrationMark size={64} className="text-ink-800" />
        {/* Escape and the default button keep their copy: the safe answer is
            the one that loses nothing */}
        <ConfirmDialog
          open
          title="Demo project"
          confirmLabel="Start over"
          cancelLabel="Open my copy"
          danger
          message={
            <>
              You already have a copy of the demo,{' '}
              <span className="font-medium text-ink-100">
                {existingDemo?.name}
              </span>
              , with anything you changed in it. Open it as it is, or start over
              from a fresh copy — your changes to the demo are then lost.
            </>
          }
          onConfirm={replaceExistingDemo}
          onCancel={keepExistingDemo}
        />
      </div>
    );
  }

  if (!active || !activePage) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-ink-void">
        <div className="flex flex-col items-center gap-4">
          <RegistrationMark size={64} className="text-ink-800" />
          {demoState === 'loading' ? (
            <p className="text-xs tracking-[0.14em] text-ink-500 uppercase">
              Loading the demo project…
            </p>
          ) : null}
        </div>
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
