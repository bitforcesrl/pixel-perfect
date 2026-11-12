/**
 * The documentation's address book: the route, every section anchor and the
 * table of contents built from them.
 *
 * Both the `/docs` page and the app's `?` help links read from here, so an
 * anchor renamed in one place cannot leave a dead link in the other.
 */

export const DOCS_PATH = '/docs';

/** One entry of the table of contents. `id` is the heading's anchor. */
export interface DocsTocEntry {
  id: string;
  title: string;
  children?: DocsTocEntry[];
}

/** Anchors of the inspector panels, keyed by the title the panel shows. */
export const PANEL_DOCS = {
  Layers: 'panel-layers',
  Align: 'panel-align',
  View: 'panel-view',
  Tools: 'panel-tools',
  History: 'panel-history',
  Notes: 'panel-notes',
} as const;

export type PanelTitle = keyof typeof PANEL_DOCS;

/** Every anchor the docs page renders, in reading order. */
export const DOCS = {
  gettingStarted: 'getting-started',
  projects: 'projects',
  pages: 'pages',
  pageFields: 'page-fields',
  viewports: 'viewports',
  loadingImages: 'loading-images',
  dragAndDrop: 'drag-and-drop',
  bulkUpload: 'bulk-upload',
  figmaExport: 'figma-export',
  figmaToken: 'figma-token',
  browserless: 'browserless',
  browserlessKey: 'browserless-key',
  localCapture: 'local-capture',
  panels: 'panels',
  sharing: 'sharing',
  shortcuts: 'shortcuts',
  selfHosting: 'self-hosting',
  ...PANEL_DOCS,
} as const;

/** The sidebar, two levels deep. Titles match the headings on the page. */
export const DOCS_TOC: DocsTocEntry[] = [
  { id: DOCS.gettingStarted, title: 'Getting started' },
  { id: DOCS.projects, title: 'Projects' },
  { id: DOCS.pages, title: 'Pages' },
  { id: DOCS.viewports, title: 'Viewports' },
  {
    id: DOCS.loadingImages,
    title: 'Loading images',
    children: [
      { id: DOCS.dragAndDrop, title: 'Drag & drop' },
      { id: DOCS.bulkUpload, title: 'Bulk upload' },
      { id: DOCS.figmaExport, title: 'Figma export' },
      { id: DOCS.browserless, title: 'Cloud capture' },
      { id: DOCS.localCapture, title: 'Local capture' },
    ],
  },
  {
    id: DOCS.panels,
    title: 'Panels',
    children: (Object.keys(PANEL_DOCS) as PanelTitle[]).map((title) => ({
      id: PANEL_DOCS[title],
      title,
    })),
  },
  { id: DOCS.sharing, title: 'Export & share' },
  { id: DOCS.shortcuts, title: 'Keyboard shortcuts' },
  { id: DOCS.selfHosting, title: 'Self-hosting' },
];

/** Link to one section of the docs, or to the top without an anchor. */
export function docsHref(anchor?: string): string {
  return anchor ? `${DOCS_PATH}#${anchor}` : DOCS_PATH;
}

/**
 * Opens the docs in a new tab, so the comparison in progress — guides, pen
 * strokes and the Figma offset are not saved — survives the visit.
 *
 * Returns false when the browser blocked the tab, so the caller can tell the
 * user instead of failing silently. (`noopener` is set by hand afterwards:
 * passed as a feature, it makes `window.open` always return null.)
 */
export function openDocs(anchor?: string): boolean {
  const tab = window.open(docsHref(anchor), '_blank');
  if (!tab) return false;
  tab.opener = null;
  return true;
}
