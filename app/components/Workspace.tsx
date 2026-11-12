'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import AnnotationLayer, { type Tool } from './AnnotationLayer';
import BrandMark from './BrandMark';
import BrowserlessKeyDialog from './BrowserlessKeyDialog';
import { CLOUD_CAPTURE_ENABLED } from '@/lib/features';
import FigmaTokenDialog from './FigmaTokenDialog';
import ExportProjectDialog from './ExportProjectDialog';
import HelpDialog from './HelpDialog';
import CaptureOverlay from './CaptureOverlay';
import ViewportStatusList from './ViewportStatusList';
import ControlPanel from './ControlPanel';
import ComparisonViewer from './ComparisonViewer';
import ConfirmDialog from './ConfirmDialog';
import MenuBar, { type Menu } from './MenuBar';
import Modal from './Modal';
import NewProjectDialog from './NewProjectDialog';
import PagesGallery from './PagesGallery';
import PageSwitcher from './PageSwitcher';
import ProjectsPanel from './ProjectsPanel';
import RegistrationMark from './RegistrationMark';
import SettingsPanel from './SettingsPanel';
import SideBySideViewer from './SideBySideViewer';
import ViewportCards from './ViewportCards';
import { useCaptureSource } from './useCaptureSource';
import { useFigmaSource } from './useFigmaSource';
import {
  annotationId,
  clampGuide,
  DEFAULT_GUIDE_COLOR,
  freeGuidePos,
  DEFAULT_PEN_COLOR,
  type Guide,
  type GuideAxis,
  type Stroke,
} from '@/lib/annotations';
import {
  captureHeaders,
  ensureKeyLoaded,
  loadKey,
  subscribeKey,
} from '@/lib/browserless-key';
import { generateDiffImage } from '@/lib/diff';
import { parseFigmaUrl, type FigmaRender } from '@/lib/figma';
import { composeFigmaRender, wasShrunk } from '@/lib/figma-compose';
import {
  figmaHeaders,
  loadFigmaToken,
  subscribeFigmaToken,
} from '@/lib/figma-token';
import type { ScrollPos } from '@/lib/scrollsync';
import {
  toCompactBlob,
  toCompactDataUrl,
  toThumbnailDataUrl,
} from '@/lib/encode';
import { readAsDataUrl, readImageSize, type ImageSize } from '@/lib/image';
import { bottomAlignOffset, clampOffset } from '@/lib/offset';
import { prewarmTiles, releaseTiles } from '@/lib/tiles';
import { inferDeviceScale } from '@/lib/device-scale';
import {
  dropSide,
  hasFiles,
  IMAGE_ACCEPT,
  imageFiles,
  type DropSide,
} from '@/lib/drop';
import {
  exportFileName,
  exportProject,
  importProject,
  type ExportOptions,
} from '@/lib/transfer';
import {
  clearAll,
  clearFigma,
  clearViewport,
  clearScreenshot,
  deleteDatabase,
  deleteHistoryEntry,
  loadHistory,
  loadNotes,
  loadSettings,
  loadSlots,
  saveFigma,
  saveHistoryEntry,
  saveNotes,
  savePreview,
  saveSettings,
  saveScreenshot,
  renameHistoryEntry,
  type HistoryEntry,
} from '@/lib/storage';
import {
  allPresets,
  DEFAULT_SETTINGS,
  enabledPresets,
  viewportLabels,
  type ViewportSettings,
} from '@/lib/settings';
import type { ScreenshotResult } from '@/lib/validation';
import { renderScaleFor } from '@/lib/render-scale';
import { DOCS_PATH, openDocs } from '@/lib/docs';
import type { Page, Project } from '@/lib/projects';
import type { BlendMode, ViewMode } from '@/lib/types';
import { SITE } from '@/lib/site';
import GitHubIcon from './GitHubIcon';
import {
  clampZoom,
  defaultZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  stepZoom,
} from '@/lib/zoom';
import {
  assignViewportByDensity,
  createSlots,
  fillSlots,
  firstReadyViewport,
  slotOf,
  type ViewportKey,
  type ViewportPreset,
  type ViewportSlot,
  type ViewportSlots,
} from '@/lib/viewports';

const CANVAS_PADDING = 48; // the p-6 gutter either side of the viewer
const CAPTURE_INSET = 25; // the p-6 gutter plus the viewer's 1px border
/**
 * Typed in full before the database is dropped.
 *
 * Printed in the dialog rather than kept secret — it is not a password, it is
 * a speed bump: something you cannot hit by pressing Return twice, and cannot
 * type by accident while meaning to reset one page.
 */
const RESET_PASSKEY = 'RESET ALL';

/**
 * Let go of a layer's object URL and the strips cut from it. A layer that is
 * replaced or removed is never shown again, so neither is worth keeping.
 */
function releaseLayerUrl(src: string): void {
  releaseTiles(src);
  URL.revokeObjectURL(src);
}

/**
 * Whether another viewport shows the same screenshot — the same file dropped
 * on two viewports is one data URL, and so one set of cut strips.
 */
function screenshotUsedElsewhere(
  slots: ViewportSlots,
  key: ViewportKey,
  image: string,
): boolean {
  return Object.entries(slots).some(
    ([other, slot]) => other !== key && slot?.screenshot?.image === image,
  );
}

/**
 * A dropped file that is not an image — said out loud, so a drop never just
 * does nothing.
 */
/** An "All" run held back because it would replace layers already there. */
interface PendingOverwrite {
  layer: 'site' | 'figma';
  /** The viewports that would lose their current layer */
  labels: string[];
  /** The run itself, started once the user agrees */
  run: () => void;
}

function notAnImageError(transfer: DataTransfer | null): string {
  const name = transfer?.files?.[0]?.name;
  return name
    ? `${name} is not an image — drop a PNG, JPEG, WebP, AVIF, GIF or BMP`
    : 'Drop a PNG, JPEG, WebP, AVIF, GIF or BMP image';
}
/**
 * The view modes, in the order the View menu and the inspector list them.
 *
 * Split leads because it is the one the workspace opens in — the list starts
 * where you already are, and the digits follow the list rather than the other
 * way round.
 */
const VIEW_MODES: { value: ViewMode; label: string; shortcut: string }[] = [
  { value: 'split', label: 'Split', shortcut: '1' },
  { value: 'overlay', label: 'Overlay', shortcut: '2' },
  { value: 'tap', label: 'Tap', shortcut: '3' },
  { value: 'sideBySide', label: 'Side by side', shortcut: '4' },
];

export interface WorkspaceProps {
  /** The project this workspace belongs to — its id namespaces the settings. */
  project: Project;
  /** The page being compared. Its id namespaces every capture, export and note. */
  page: Page;
  projects: Project[];
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  /** A project unpacked from an export, its work already written to storage. */
  onImportProject: (project: Project) => void;
  onSelectPage: (id: string) => void;
  onCreatePage: (name: string, url: string) => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;
  onUrlChange: (url: string, pageId?: string) => void;
  onSitePasswordChange: (sitePassword: string, pageId: string) => void;
  onFigmaUrlChange: (key: ViewportKey, url: string, pageId: string) => void;
}

/**
 * One page's working session.
 *
 * Mounted keyed by page id, so opening another page tears this down and builds
 * it again: every hydration effect below runs once per page and none of the
 * previous page's state can leak across.
 */
export default function Workspace({
  project,
  page,
  projects,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onImportProject,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onUrlChange,
  onSitePasswordChange,
  onFigmaUrlChange,
}: WorkspaceProps) {
  const projectId = project.id;
  const pageId = page.id;
  const url = page.url;
  const [storedSlots, setSlots] = useState<ViewportSlots>(createSlots);
  const [preferredViewport, setPreferredViewport] =
    useState<ViewportKey | null>(null);
  const [opacity, setOpacity] = useState(100);
  const [blendMode, setBlendMode] = useState<BlendMode>('normal');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [zoom, setZoom] = useState(1);
  // Which viewport the current zoom was defaulted for
  const [zoomedFor, setZoomedFor] = useState<string | null>(null);
  // View state, so it resets with everything else on reload
  const [syncScroll, setSyncScroll] = useState(true);
  // Off by default: dragging pans the canvas until you opt into moving Figma
  const [figmaDragEnabled, setFigmaDragEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // Packing or unpacking a project ZIP — one at a time, either direction
  const [isTransferring, setIsTransferring] = useState(false);
  const [settings, setSettings] = useState<ViewportSettings>(DEFAULT_SETTINGS);
  // Every viewport the project has, empty or not — viewports come and go with
  // the settings, and readers index by key without checking
  const slots = useMemo(
    () => fillSlots(storedSlots, Object.keys(settings)),
    [storedSlots, settings],
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  // The inspector is a panel, not the app: View ▸ Show inspector gives the
  // canvas the whole window back
  const [showInspector, setShowInspector] = useState(true);
  // An export is being dragged over the canvas — it lands on the viewport the
  // canvas is showing
  const [canvasDrop, setCanvasDrop] = useState<DropSide | null>(null);
  // Where a capture's browser comes from, and whether this machine has one
  const { source, localAvailable } = useCaptureSource();
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  // Local storage is not readable while rendering on the server, so the key is
  // subscribed to rather than read: false until the client says otherwise
  const hasKey = useSyncExternalStore(
    subscribeKey,
    () => loadKey() !== null,
    () => false,
  );
  // Where a Figma export's token comes from, and the dialog that takes one
  const figmaSource = useFigmaSource();
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  // File ▸ Export project asks what to include before building the ZIP
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  // Help ▸ Keyboard shortcuts
  const [helpOpen, setHelpOpen] = useState(false);
  const [figmaTokenError, setFigmaTokenError] = useState<string | null>(null);
  const hasFigmaToken = useSyncExternalStore(
    subscribeFigmaToken,
    () => loadFigmaToken() !== null,
    () => false,
  );
  // The viewports whose Figma frame is being rendered right now
  const [figmaBusy, setFigmaBusy] = useState<Record<ViewportKey, boolean>>({});
  // Which browser took the last capture — printed in the status bar
  const [lastBrowser, setLastBrowser] = useState<
    'local' | 'browserless' | null
  >(null);
  // ── The annotation tools. Deliberately not persisted: guides and marks are
  //    what you are saying about this screen right now, not part of the page.
  const [tool, setTool] = useState<Tool>('none');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [guideColor, setGuideColor] = useState(DEFAULT_GUIDE_COLOR);
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penWidth, setPenWidth] = useState(2);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  // Which destructive command is waiting to be confirmed, if any
  const [confirming, setConfirming] = useState<'page' | 'everything' | null>(
    null,
  );
  // An "All" run that would replace layers already in place, held until the
  // user agrees: a bad run (a password page, an error page, a cookie wall)
  // would otherwise overwrite every good capture at once
  const [pendingOverwrite, setPendingOverwrite] =
    useState<PendingOverwrite | null>(null);
  const canvasRef = useRef<HTMLElement>(null);
  // The running capture and Figma runs, so Stop on the overlay can end them
  const captureAbortRef = useRef<AbortController | null>(null);
  const figmaAbortRef = useRef<AbortController | null>(null);
  // The box the annotation layer fills — guide positions are measured in it
  const annotationBoxRef = useRef<HTMLDivElement>(null);
  // Where the view is looking, in image px of the capture — the one measure
  // every view mode shares, so switching between them lands on the same spot
  const scrollPosRef = useRef<ScrollPos>({ top: 0, left: 0 });
  // The latest drop per layer and viewport. Decoding is async, so a heavy file
  // dropped first can finish after a light one dropped next — only the latest
  // may land.
  const dropSeqRef = useRef<Record<string, number>>({});
  const nextDrop = (slot: string) => {
    const seq = (dropSeqRef.current[slot] ?? 0) + 1;
    dropSeqRef.current[slot] = seq;
    return () => dropSeqRef.current[slot] === seq;
  };
  // The I accelerator opens the same picker the drop zone uses
  const figmaInputRef = useRef<HTMLInputElement>(null);
  // The Layers panel's site upload: screenshots routed to viewports by width
  const siteInputRef = useRef<HTMLInputElement>(null);
  // File ▸ Import project picks a ZIP made by File ▸ Export project
  const projectInputRef = useRef<HTMLInputElement>(null);
  // A modal dialog owns the keyboard while it is up — Escape closes it, and
  // nothing behind it should be answering keys in the meantime
  const modalRef = useRef(false);

  const patchSlot = (key: ViewportKey, patch: Partial<ViewportSlot>) => {
    setSlots((prev) => ({
      ...prev,
      [key]: { ...slotOf(prev, key), ...patch },
    }));
  };

  /**
   * Refresh what this page looks like in the gallery. Called with whichever
   * layer just arrived, so a page shows the last thing it captured.
   */
  const refreshPreview = async (src: string) => {
    const thumbnail = await toThumbnailDataUrl(src);
    if (thumbnail) void savePreview(pageId, thumbnail);
  };

  // Revoke every object URL still held when the app goes away
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(() => {
    return () => {
      for (const slot of Object.values(slotsRef.current)) {
        if (slot.figmaSrc) releaseLayerUrl(slot.figmaSrc);
      }
    };
  }, []);

  // Cut every viewport's layers into strips while you look at one of them, so
  // switching viewport paints at once instead of decoding a full-page bitmap
  useEffect(() => {
    for (const slot of Object.values(slots)) {
      if (slot.screenshot) prewarmTiles(slot.screenshot.image);
      if (slot.figmaSrc) prewarmTiles(slot.figmaSrc);
    }
  }, [slots]);

  // Bring back the last capture and upload. Object URLs die with the document,
  // so the stored blobs get fresh ones here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadSlots(pageId);
      if (cancelled) return;
      // Built outside the updater: React runs updaters twice under Strict Mode,
      // and creating the URLs in there would leak one per slot per render.
      const patches = new Map<ViewportKey, Partial<ViewportSlot>>();
      for (const [key, record] of Object.entries(stored)) {
        patches.set(key, {
          screenshot: record.screenshot,
          figmaSrc: record.figmaBlob
            ? URL.createObjectURL(record.figmaBlob)
            : null,
          figmaFileName: record.figmaFileName,
        });
      }
      if (patches.size === 0) return;
      // status stays "idle": a restored capture is finished, not in flight
      setSlots((prev) => {
        const next = { ...prev };
        for (const [key, patch] of patches) {
          next[key] = { ...slotOf(prev, key), ...patch };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await loadHistory(pageId);
      if (!cancelled) setHistory(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // The last value written, so the debounce can tell a real edit from the
  // render hydration itself causes. null until hydration has happened.
  const savedNotesRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadNotes(pageId);
      if (cancelled) return;
      setNotes(stored);
      savedNotesRef.current = stored;
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  // One write per pause, not one per keystroke
  useEffect(() => {
    if (savedNotesRef.current === null || savedNotesRef.current === notes)
      return;
    const timer = setTimeout(() => {
      savedNotesRef.current = notes;
      void saveNotes(pageId, notes);
    }, 400);
    return () => clearTimeout(timer);
  }, [notes, pageId]);

  // Switching page takes this workspace down with the debounce still pending,
  // so the last keystrokes are written out on the way out
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    return () => {
      const pending = notesRef.current;
      if (savedNotesRef.current === null || savedNotesRef.current === pending)
        return;
      void saveNotes(pageId, pending);
    };
  }, [pageId]);

  // Hydrate settings from IndexedDB — per project, so every page of it is
  // captured at the same sizes
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadSettings(projectId);
      if (cancelled) return;
      setSettings(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Persist settings on change, debounced
  const savedSettingsRef = useRef<ViewportSettings | null>(null);
  useEffect(() => {
    if (savedSettingsRef.current === null) {
      savedSettingsRef.current = settings;
      return;
    }
    if (savedSettingsRef.current === settings) return;
    const timer = setTimeout(() => {
      savedSettingsRef.current = settings;
      void saveSettings(projectId, settings);
    }, 400);
    return () => clearTimeout(timer);
  }, [settings, projectId]);

  // No re-routing of stored exports when the settings change: the picker routes
  // by width once, on import, and a drop on a card is a deliberate choice of
  // viewport. Moving them afterwards second-guessed the drop and, with two
  // exports trading places, dropped one of them for good.

  const presets = enabledPresets(settings);
  const labels = viewportLabels(settings);

  /**
   * The viewport being worked on — what the tabs point at and what the Capture
   * button captures.
   *
   * An explicit pick sticks even while that viewport is empty: going to a
   * viewport is how you get somewhere to capture. With no pick, the narrowest
   * viewport holding something takes it, and failing that the first enabled one,
   * so there is always a viewport to capture into.
   */
  const activeViewport: ViewportKey | null =
    preferredViewport &&
    presets.some((preset) => preset.key === preferredViewport)
      ? preferredViewport
      : (firstReadyViewport(slots, null, presets) ?? presets[0]?.key ?? null);
  const activeSlot = activeViewport ? slots[activeViewport] : null;
  const screenshotHeight = activeSlot?.screenshot?.height ?? null;
  const figmaHeight = activeSlot?.figmaHeight ?? null;
  const offsetY = activeSlot?.offsetY ?? 0;

  // Switching viewport starts you at that viewport's default zoom; switching
  // view mode keeps the zoom you had. Adjusted during render rather than in an
  // effect, so the canvas never paints one frame at the outgoing zoom.
  if (activeViewport !== null && activeViewport !== zoomedFor) {
    setZoomedFor(activeViewport);
    setZoom(defaultZoom(viewMode, settings[activeViewport]?.width ?? 0));
  }

  // ↑/↓ nudge the Figma layer (⇧ for 10px) — the main alignment gesture
  useEffect(() => {
    if (activeViewport === null || screenshotHeight === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      // Already answered — the open menu walking its items, a focused guide
      // moving itself — or a dialog has the keyboard
      if (e.defaultPrevented || modalRef.current) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? -1 : 1);
      setSlots((prev) => {
        const slot = slotOf(prev, activeViewport);
        return {
          ...prev,
          [activeViewport]: {
            ...slot,
            offsetY: clampOffset(
              slot.offsetY + step,
              screenshotHeight,
              slot.figmaHeight,
            ),
          },
        };
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeViewport, screenshotHeight]);

  const setOffsetY = (value: number) => {
    if (activeViewport === null) return;
    patchSlot(activeViewport, { offsetY: value });
  };

  /** Same move the arrow keys make, from the Align menu. */
  const nudgeFigma = (delta: number) => {
    if (screenshotHeight === null) return;
    setOffsetY(clampOffset(offsetY + delta, screenshotHeight, figmaHeight));
  };

  const alignFigma = (value: number) => {
    if (screenshotHeight === null) return;
    setOffsetY(clampOffset(value, screenshotHeight, figmaHeight));
  };

  const setFigmaHeight = (height: number | null) => {
    if (activeViewport === null) return;
    patchSlot(activeViewport, { figmaHeight: height });
  };

  /**
   * Width the canvas renders at zoom 1: the capture when there is one, otherwise
   * the Figma export's natural width (the Figma-only view sizes by its own pixels).
   */
  const measureFitWidth = async (): Promise<number | null> => {
    if (activeSlot?.screenshot) return activeSlot.screenshot.width;
    if (!activeSlot?.figmaSrc) return null;
    const size = await readImageSize(activeSlot.figmaSrc).catch(() => null);
    return size?.width ?? null;
  };

  /** Shrink (or grow) the visible layer until its width fills the canvas. */
  const zoomToFit = async () => {
    const width = await measureFitWidth();
    const canvas = canvasRef.current;
    if (!width || !canvas) return;
    // Side by side only splits the canvas when both layers are on screen
    const panes =
      viewMode === 'sideBySide' && activeSlot?.screenshot && activeSlot.figmaSrc
        ? 2
        : 1;
    const fit = (canvas.clientWidth / panes - CANVAS_PADDING) / width;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit)));
  };

  /**
   * Route each export to a viewport by its pixel width, read at 1x or 2x
   * (`assignViewportByDensity`). Last file wins.
   */
  const handleFigmaFilesChange = async (files: File[]) => {
    const assigned = new Map<
      ViewportKey,
      { src: string; name: string; blob: Blob; isLatest: () => boolean }
    >();
    const unreadable: string[] = [];
    // Figma routing always considers every viewport — a 375 px export is mobile
    // even when mobile is temporarily disabled in settings.
    const routingPresets = allPresets(settings);

    for (const file of files) {
      const original = URL.createObjectURL(file);
      let src = original;
      try {
        const { width } = await readImageSize(original);
        const key = assignViewportByDensity(width, routingPresets);
        // Claimed as soon as the viewport is known: a drop on the same
        // viewport made while this file is still encoding must win over it
        const isLatest = nextDrop(`figma:${key}`);
        // Re-encode once, up front, so the layer you align is the one that
        // comes back after a reload
        const compact = await toCompactBlob(original);
        if (compact) {
          URL.revokeObjectURL(original);
          src = URL.createObjectURL(compact);
        }
        const superseded = assigned.get(key);
        if (superseded) URL.revokeObjectURL(superseded.src);
        assigned.set(key, {
          src,
          name: file.name,
          blob: compact ?? file,
          isLatest,
        });
      } catch {
        URL.revokeObjectURL(src);
        unreadable.push(file.name);
      }
    }

    // Anything dropped on the same viewport since then has already landed
    for (const [key, entry] of assigned) {
      if (entry.isLatest()) continue;
      URL.revokeObjectURL(entry.src);
      assigned.delete(key);
    }

    if (assigned.size > 0) {
      setSlots((prev) => {
        const next = { ...prev };
        for (const [key, { src, name }] of assigned) {
          const replaced = slotOf(prev, key).figmaSrc;
          if (replaced && replaced !== src) releaseLayerUrl(replaced);
          next[key] = {
            ...slotOf(prev, key),
            figmaSrc: src,
            figmaFileName: name,
            figmaHeight: null,
            offsetY: 0,
          };
        }
        return next;
      });
      for (const [key, { name, blob }] of assigned) {
        void saveFigma(pageId, key, blob, name);
      }
      // A page with no capture yet still deserves a face in the gallery: the
      // Figma export is the only thing it has to show.
      const hasCapture = Object.values(slots).some(
        (slot) => slot.screenshot !== null,
      );
      const first = assigned.values().next();
      if (!hasCapture && !first.done) void refreshPreview(first.value.src);
    }

    setUploadError(
      unreadable.length > 0 ? `Could not read ${unreadable.join(', ')}` : null,
    );
  };

  /**
   * Drop an export straight onto a viewport, whatever it measures.
   *
   * The picker routes by width because it has nothing else to go on; a drop
   * has somewhere it was aimed, and that wins. Dropping a 1440 export on the
   * mobile card is how you compare a desktop mock against the phone capture,
   * so the width is never second-guessed here. One file per drop — a drop is
   * a single destination, so extra files would have nowhere to go.
   */
  const handleFigmaDropOn = async (key: ViewportKey, file: File) => {
    const isLatest = nextDrop(`figma:${key}`);
    const original = URL.createObjectURL(file);
    let src = original;
    let blob: Blob = file;
    try {
      // Reads the image before anything is stored: a file that is not one
      // fails here rather than landing on the canvas as a broken layer
      await readImageSize(original);
      const compact = await toCompactBlob(original);
      if (!isLatest()) {
        URL.revokeObjectURL(original);
        return;
      }
      if (compact) {
        URL.revokeObjectURL(original);
        src = URL.createObjectURL(compact);
        blob = compact;
      }
    } catch {
      URL.revokeObjectURL(original);
      setUploadError(`Could not read ${file.name}`);
      return;
    }

    setSlots((prev) => {
      const replaced = slotOf(prev, key).figmaSrc;
      if (replaced && replaced !== src) releaseLayerUrl(replaced);
      return {
        ...prev,
        [key]: {
          ...slotOf(prev, key),
          figmaSrc: src,
          figmaFileName: file.name,
          figmaHeight: null,
          offsetY: 0,
        },
      };
    });
    void saveFigma(pageId, key, blob, file.name);
    setPreferredViewport(key);
    setUploadError(null);

    const hasCapture = Object.values(slots).some(
      (slot) => slot.screenshot !== null,
    );
    if (!hasCapture) void refreshPreview(src);
  };

  /**
   * Put a site screenshot on a viewport — the one way a capture or a drop
   * lands, so both free the strips of the picture they replace.
   */
  const landScreenshot = (
    key: ViewportKey,
    screenshot: ScreenshotResult,
    { resetOffset }: { resetOffset: boolean },
  ) => {
    setSlots((prev) => {
      const current = slotOf(prev, key);
      // The old picture is never shown again: free its strips now
      const old = current.screenshot?.image;
      if (
        old &&
        old !== screenshot.image &&
        !screenshotUsedElsewhere(prev, key, old)
      ) {
        releaseTiles(old);
      }
      // The Figma layer is fitted to the capture's width, so its fitted height
      // scales with it. The viewer only reports it when the export decodes, so
      // a new capture of another width would otherwise leave the align
      // controls measuring against the old one.
      const oldWidth = current.screenshot?.width;
      const figmaHeight =
        current.figmaHeight !== null && oldWidth
          ? current.figmaHeight * (screenshot.width / oldWidth)
          : current.figmaHeight;
      return {
        ...prev,
        [key]: {
          ...current,
          screenshot,
          figmaHeight,
          status: 'ready' as const,
          error: null,
          ...(resetOffset ? { offsetY: 0 } : {}),
        },
      };
    });
  };

  /**
   * Drop a screenshot file straight onto a viewport.
   *
   * Lets you bypass the API and use a local screenshot instead — useful when
   * the site is behind a login wall or you already have the capture you need.
   * The file is re-encoded (WebP, else JPEG) and stored exactly like an API
   * capture — sized in CSS px like one too: a retina shot of the viewport is
   * recognised by its width (`lib/device-scale.ts`), so it lays out at the
   * same size as a capture and every offset keeps counting CSS px.
   */
  const handleScreenshotDrop = async (key: ViewportKey, file: File) => {
    const landed = await landScreenshotFile(key, file);
    if (landed) setUploadError(null);
    else setUploadError(`Could not read ${file.name}`);
  };

  /**
   * Upload site screenshots from the picker, each routed to a viewport by its
   * width read at 1x or 2x (`assignViewportByDensity`) — the same rule the
   * Figma picker follows. Several files for one viewport: the last one wins.
   */
  const handleScreenshotFilesChange = async (files: File[]) => {
    // Like Figma routing, every viewport counts — a 750 px shot is mobile
    // even while mobile is switched off in settings
    const routingPresets = allPresets(settings);
    const routed = new Map<ViewportKey, { file: File; size: ImageSize }>();
    const unreadable: string[] = [];

    // Measure first, land after: a file superseded on its viewport is never
    // encoded at all
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const size = await readImageSize(url);
        routed.set(assignViewportByDensity(size.width, routingPresets), {
          file,
          size,
        });
      } catch {
        unreadable.push(file.name);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    // One at a time: each re-encode holds a full-size bitmap in memory
    for (const [key, { file, size }] of routed) {
      if (!(await landScreenshotFile(key, file, size))) {
        unreadable.push(file.name);
      }
    }

    setUploadError(
      unreadable.length > 0 ? `Could not read ${unreadable.join(', ')}` : null,
    );
  };

  /**
   * Read, re-encode and land one screenshot file on `key`. `known` skips the
   * size read when the caller already measured the file. Resolves false when
   * the file could not be read; a file superseded by a later drop on the same
   * viewport still resolves true — nothing went wrong, it just lost the race.
   */
  const landScreenshotFile = async (
    key: ViewportKey,
    file: File,
    known?: ImageSize,
  ): Promise<boolean> => {
    const isLatest = nextDrop(`site:${key}`);
    const original = URL.createObjectURL(file);
    try {
      const natural = known ?? (await readImageSize(original));
      const cssWidth =
        allPresets(settings).find((preset) => preset.key === key)?.width ?? 0;
      const scale = inferDeviceScale(natural.width, cssWidth);
      // The original bytes stay only when they are already the lighter file,
      // or the picture is past what a JPEG can hold
      const image =
        (await toCompactDataUrl(original)) ?? (await readAsDataUrl(file));
      URL.revokeObjectURL(original);
      if (!isLatest()) return true;
      const screenshot = {
        image,
        width: Math.round(natural.width / scale),
        height: Math.round(natural.height / scale),
      };
      // A new base layer starts aligned, as a new Figma layer does: the old
      // offset was measured against a different picture
      landScreenshot(key, screenshot, { resetOffset: true });
      void saveScreenshot(pageId, key, screenshot);
      void refreshPreview(image);
      setPreferredViewport(key);
      return true;
    } catch {
      URL.revokeObjectURL(original);
      return false;
    }
  };

  const handleRemoveFigma = (key: ViewportKey) => {
    const src = slots[key].figmaSrc;
    if (src) releaseLayerUrl(src);
    patchSlot(key, { figmaSrc: null, figmaFileName: null, figmaHeight: null });
    void clearFigma(pageId, key);
  };

  /** Drop a viewport's site capture, leaving its Figma export in place. */
  const handleRemoveScreenshot = (key: ViewportKey) => {
    if (slots[key].status === 'capturing') return;
    const image = slots[key].screenshot?.image;
    if (image && !screenshotUsedElsewhere(slots, key, image)) {
      releaseTiles(image);
    }
    patchSlot(key, { screenshot: null, status: 'idle', error: null });
    void clearScreenshot(pageId, key);
  };

  /** Archive a viewport's current Figma export, alignment included. */
  const handleSaveSnapshot = async (key: ViewportKey) => {
    const slot = slots[key];
    if (!slot.figmaSrc || !slot.figmaFileName) return;
    try {
      // The slot holds an object URL, not bytes — this reads back the blob it
      // points at. Same document, no network.
      const blob = await (await fetch(slot.figmaSrc)).blob();
      await saveHistoryEntry({
        projectId,
        pageId,
        viewport: key,
        blob,
        fileName: slot.figmaFileName,
        offsetY: slot.offsetY,
      });
      // Re-read rather than append: the store assigns the id
      setHistory(await loadHistory(pageId));
      setUploadError(null);
    } catch {
      setUploadError('Could not save that export');
    }
  };

  /** Put an archived export back on its own viewport, offset and all. */
  const handleLoadSnapshot = (entry: HistoryEntry) => {
    // Newer than any drop still encoding for this viewport: that one must not
    // land over the snapshot once it finishes
    nextDrop(`figma:${entry.viewport}`);
    const replaced = slotOf(slots, entry.viewport).figmaSrc;
    if (replaced) releaseLayerUrl(replaced);
    patchSlot(entry.viewport, {
      figmaSrc: URL.createObjectURL(entry.blob),
      figmaFileName: entry.fileName,
      figmaHeight: null,
      offsetY: entry.offsetY,
    });
    // The restored export becomes the current one, so a reload keeps it
    void saveFigma(pageId, entry.viewport, entry.blob, entry.fileName);
    setPreferredViewport(entry.viewport);
    setUploadError(null);
  };

  const handleDeleteSnapshot = (id: number) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
    void deleteHistoryEntry(id);
  };

  /** The name is the only thing about a snapshot that is yours to change. */
  const handleRenameSnapshot = (id: number, name: string) => {
    setHistory((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, fileName: name } : entry,
      ),
    );
    void renameHistoryEntry(id, name);
  };

  /**
   * Capture the given viewports, one at a time.
   *
   * The captures used to go out together, which only ever queued somewhere
   * worse: a Browserless plan allows a set number of concurrent sessions (one on
   * the free tier), so the extra requests either came back 429 or sat waiting
   * while the session clock they were waiting on ran down. Serially, each
   * capture gets a browser to itself and its full time budget. Every tab is
   * marked up front so the queue is visible, and each settles as its turn ends.
   */
  const runCaptures = (
    targets: ViewportPreset[],
    opts: { local?: boolean } = {},
  ) => {
    if (targets.length === 0 || url.trim() === '') return;
    // The deployment has no key of its own (production): the user's key is
    // read from IndexedDB first — instant after the first read — so a capture
    // asked for right after load does not mistake "not read yet" for "none".
    if (!opts.local && source === 'key') {
      void ensureKeyLoaded().then((key) => {
        if (key !== null) {
          startCaptures(targets, opts);
          return;
        }
        // Nothing to capture with. Asking for the key beats three cards
        // failing with the same message on them.
        setKeyError(null);
        setKeyDialogOpen(true);
      });
      return;
    }
    startCaptures(targets, opts);
  };

  /** The run itself, once there is something to capture with. */
  const startCaptures = (
    targets: ViewportPreset[],
    opts: { local?: boolean } = {},
  ) => {
    setUploadError(null);
    // Each viewport's site layer is claimed now, when the run is asked for: a
    // screenshot dropped on one of them while the run is still going is the
    // newer choice, and the capture must not land over it
    const claims = new Map(
      targets.map((preset) => [preset.key, nextDrop(`site:${preset.key}`)]),
    );
    const isLatestFor = (key: ViewportKey) => claims.get(key)?.() ?? false;
    setSlots((prev) => {
      const next = { ...prev };
      for (const preset of targets) {
        next[preset.key] = {
          ...slotOf(prev, preset.key),
          status: 'capturing',
          error: null,
        };
      }
      return next;
    });

    // Stop on the overlay aborts the request in flight and skips the rest
    const controller = new AbortController();
    captureAbortRef.current = controller;
    const { signal } = controller;

    void (async () => {
      for (const preset of targets) {
        if (signal.aborted) break;
        // Already replaced by a drop: no point shooting it
        if (!isLatestFor(preset.key)) continue;
        try {
          const res = await fetch('/api/screenshot', {
            method: 'POST',
            signal,
            headers: await captureHeaders({ local: opts.local }),
            body: JSON.stringify({
              url,
              viewportWidth: preset.width,
              viewportHeight: preset.height,
              sitePassword: page.sitePassword || undefined,
            }),
          });
          const data = await res.json();
          if (signal.aborted) break;
          // The key was removed or refused. That is a thing to fix in a dialog,
          // not an error to leave sitting on every card of the run.
          if (!res.ok && data?.needsKey) {
            setKeyError(data.error ?? 'Add a Browserless key to capture');
            setKeyDialogOpen(true);
            releaseCapturing(targets);
            break;
          }
          if (!isLatestFor(preset.key)) continue;
          if (!res.ok) {
            patchSlot(preset.key, {
              status: 'error',
              error: data.error ?? 'Screenshot failed',
            });
            continue;
          }
          // PNG off the wire, WebP (or JPEG) from here on: ~10x lighter to
          // hold and to store, and identical before and after a reload
          const captured = data as ScreenshotResult;
          const compact = await toCompactDataUrl(captured.image);
          const screenshot = compact
            ? { ...captured, image: compact }
            : captured;
          if (signal.aborted) break;
          // A drop made while this one was encoding has already landed
          if (!isLatestFor(preset.key)) continue;
          // A recapture of the same page keeps its alignment
          landScreenshot(preset.key, screenshot, { resetOffset: false });
          void saveScreenshot(pageId, preset.key, screenshot);
          setLastBrowser(opts.local ? 'local' : 'browserless');
          // Presets run narrowest first, so the gallery ends up showing the
          // widest capture this run produced
          void refreshPreview(screenshot.image);
        } catch (err) {
          // Stopped by the user: not an error on any card
          if (signal.aborted) break;
          // A drop that replaced this capture is not an error on its card
          if (!isLatestFor(preset.key)) continue;
          patchSlot(preset.key, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
          });
        }
      }
      // A stopped run leaves the viewports it never reached as they were
      if (signal.aborted) releaseCapturing(targets);
      if (captureAbortRef.current === controller) {
        captureAbortRef.current = null;
      }
    })();
  };

  /** Viewports still marked as capturing go back to idle — nothing landed. */
  const releaseCapturing = (targets: ViewportPreset[]) =>
    setSlots((prev) => {
      const next = { ...prev };
      for (const entry of targets) {
        const slot = slotOf(prev, entry.key);
        if (slot.status !== 'capturing') continue;
        next[entry.key] = { ...slot, status: 'idle' };
      }
      return next;
    });

  /**
   * A card's Capture button: that card's viewport, now.
   *
   * Deliberately not the settings' whole enabled set — one card, one browser
   * session. Selecting the card as well as shooting it: the capture you just
   * asked for is the one you want to be looking at when it lands.
   */
  const handleCaptureViewport = (
    key: ViewportKey,
    opts: { local?: boolean } = {},
  ) => {
    const preset = presets.find((entry) => entry.key === key);
    if (!preset) return;
    setPreferredViewport(key);
    runCaptures([preset], opts);
  };

  /** Same shot from the keyboard and the Capture menu: whichever card is on. */
  const handleCaptureCurrent = (opts: { local?: boolean } = {}) => {
    if (activeViewport) handleCaptureViewport(activeViewport, opts);
  };

  const handleCaptureAll = (opts: { local?: boolean } = {}) =>
    runCaptures(presets, opts);

  /** The frame a viewport is exported from, when its link can be read. */
  const figmaTargetOf = (key: ViewportKey) =>
    parseFigmaUrl(page.figmaUrls[key] ?? '');

  /**
   * The bytes of a Figma render: straight from Figma's storage when it allows
   * it, through this app's own route when the browser is refused.
   */
  const downloadFigmaRender = async (
    renderUrl: string,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    let image: Response;
    try {
      image = await fetch(renderUrl, { signal });
      if (!image.ok) throw new Error(String(image.status));
    } catch (err) {
      // Stopped by the user: no fallback download either
      if (signal?.aborted) throw err;
      image = await fetch(
        `/api/figma?render=${encodeURIComponent(renderUrl)}`,
        {
          signal,
          headers: await figmaHeaders(),
        },
      );
    }
    if (!image.ok) throw new Error('could not download the render');
    return image.blob();
  };

  /**
   * Render each viewport's Figma frame at its width's scale (2x on mobile,
   * sliding to 1x on desktop — `lib/render-scale.ts`) and land it as that viewport's
   * Figma layer.
   *
   * Figma renders the frame and hands back where the PNG is; the browser
   * downloads it from there and it goes through the same path as a dropped
   * export. One frame at a time, like captures: the API rate limits renders,
   * and a run that fails part way leaves the frames already done in place.
   */
  const runFigmaExports = (targets: ViewportPreset[]) => {
    const jobs = targets.flatMap((preset) => {
      const target = figmaTargetOf(preset.key);
      return target ? [{ preset, target }] : [];
    });
    if (jobs.length === 0) {
      setUploadError(
        `No Figma frame link for ${targets.map((preset) => preset.label).join(', ')} — set one under File ▸ Pages`,
      );
      return;
    }
    if (figmaSource === 'key' && loadFigmaToken() === null) {
      setFigmaTokenError(null);
      setFigmaDialogOpen(true);
      return;
    }
    setUploadError(null);
    setFigmaBusy((prev) => {
      const next = { ...prev };
      for (const { preset } of jobs) next[preset.key] = true;
      return next;
    });
    const done = (key: ViewportKey) =>
      setFigmaBusy((prev) => ({ ...prev, [key]: false }));

    // The run has had to stop — sign-in gone, or a token to ask for
    const stopped = new Error('stopped');
    // Figma's real render limit, once a shrunk render has given it away: the
    // route slices by it for the rest of the run
    let learnedArea: number | null = null;
    const learn = (area: number | null) => {
      if (area !== null) {
        learnedArea = learnedArea === null ? area : Math.min(learnedArea, area);
      }
    };

    // Stop on the overlay aborts the render in flight and skips the rest
    const controller = new AbortController();
    figmaAbortRef.current = controller;
    const { signal } = controller;
    const download = (renderUrl: string) =>
      downloadFigmaRender(renderUrl, signal);

    void (async () => {
      for (const [index, { preset, target }] of jobs.entries()) {
        if (signal.aborted) break;
        try {
          /**
           * The frame's render scale, once the route has picked it from the
           * frame's width: every slice asked for after is rendered at it too.
           */
          let frameScale: number | null = null;
          /** The route's answer for this frame, or for one part of it. */
          const ask = async (nodeId: string, slice: boolean) => {
            const res = await fetch('/api/figma', {
              method: 'POST',
              signal,
              headers: await figmaHeaders(),
              body: JSON.stringify({
                fileKey: target.fileKey,
                nodeId,
                slice,
                ...(learnedArea !== null ? { maxArea: learnedArea } : {}),
                ...(frameScale !== null ? { scale: frameScale } : {}),
              }),
            });
            const data = await res.json();
            if (!res.ok && data?.needsToken) {
              setFigmaTokenError(
                data.error ?? 'Add a Figma token to export frames',
              );
              setFigmaDialogOpen(true);
              for (const job of jobs.slice(index)) done(job.preset.key);
              throw stopped;
            }
            if (!res.ok) throw new Error(data.error ?? 'Figma export failed');
            return data as FigmaRender;
          };

          let render = await ask(target.nodeId, false);
          frameScale = render.scale;

          let blob: Blob | null = null;
          if (render.url) {
            blob = await download(render.url);
            // Figma shrinks a render past its size limit rather than refusing
            // it: when it did, ask again for the frame in slices at its scale
            if (render.width && render.height) {
              const probe = URL.createObjectURL(blob);
              const rendered = await readImageSize(probe).catch(() => null);
              URL.revokeObjectURL(probe);
              if (
                rendered &&
                wasShrunk(
                  rendered,
                  render.width * render.scale,
                  render.height * render.scale,
                )
              ) {
                learn(rendered.width * rendered.height);
                blob = null;
                render = await ask(target.nodeId, true);
              }
            }
          }

          let warning = render.warning ?? null;
          if (!blob) {
            const composed = await composeFigmaRender(render, {
              download,
              slice: (nodeId, maxArea) => {
                learn(maxArea);
                return ask(nodeId, true);
              },
            });
            blob = composed.blob;
            if (composed.shrunk > 0) {
              const parts = `${composed.shrunk} part${composed.shrunk === 1 ? '' : 's'}`;
              warning = `${parts} could not be sliced small enough for Figma to render at ${render.scale}x and ${composed.shrunk === 1 ? 'was' : 'were'} stretched into place`;
            }
          }

          // Stopped while the last part was arriving: nothing lands
          if (signal.aborted) break;
          const file = new File([blob], `${render.name}@${render.scale}x.png`, {
            type: 'image/png',
          });
          await handleFigmaDropOn(preset.key, file);
          // After the drop, which clears the message line on success
          if (warning) setUploadError(`${preset.label}: ${warning}`);
        } catch (err) {
          // A token to ask for: the jobs left were released before the throw
          if (err === stopped) break;
          // Stopped by the user: not an error worth reporting
          if (signal.aborted) break;
          setUploadError(
            `${preset.label}: ${err instanceof Error ? err.message : 'Network error'}`,
          );
        }
        done(preset.key);
      }
      // A stopped run releases every frame it had not finished
      if (signal.aborted) for (const job of jobs) done(job.preset.key);
      if (figmaAbortRef.current === controller) figmaAbortRef.current = null;
    })();
  };

  /**
   * Stop on the overlay: abort whatever capture or render is in flight and
   * release the viewports at once, so the app unlocks without waiting for the
   * aborted requests to settle. What already landed stays.
   */
  const handleStopRuns = () => {
    captureAbortRef.current?.abort();
    figmaAbortRef.current?.abort();
    releaseCapturing(presets);
    setFigmaBusy({});
  };

  const isExportingFigma = Object.values(figmaBusy).some(Boolean);

  const handleFigmaExport = (key: ViewportKey) => {
    const preset = presets.find((entry) => entry.key === key);
    if (!preset || figmaBusy[key]) return;
    setPreferredViewport(key);
    runFigmaExports([preset]);
  };

  const handleDownloadDiff = async () => {
    if (!activeSlot?.screenshot || !activeSlot.figmaSrc) return;
    setIsDownloading(true);
    try {
      const blob = await generateDiffImage(
        activeSlot.screenshot.image,
        activeSlot.figmaSrc,
        activeSlot.screenshot.width,
        activeSlot.screenshot.height,
        activeSlot.offsetY,
      );
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `diff-${activeViewport}.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Diff generation failed',
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportProject = async (options: ExportOptions) => {
    setExportDialogOpen(false);
    setIsTransferring(true);
    try {
      // Notes and settings are written on a debounce: flush them, so the
      // archive carries what is on screen and not what was there a moment ago
      await saveNotes(pageId, notes);
      await saveSettings(projectId, settings);
      const blob = await exportProject(project, options);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = exportFileName(project);
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleImportProject = async (file: File) => {
    setIsTransferring(true);
    try {
      onImportProject(await importProject(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsTransferring(false);
    }
  };

  /**
   * Drop a guide across the middle of what is on screen.
   *
   * The middle of the *canvas*, not of the capture: a guide is dropped to be
   * dragged onto something, and landing it where you are already looking is
   * the shortest way to that. Its position is canvas px, like every other
   * annotation, so it survives switching view mode.
   */
  const addGuide = (axis: GuideAxis) => {
    const canvas = canvasRef.current;
    const box = annotationBoxRef.current;
    if (!canvas || !box) return;
    // What of the annotation box is on screen, in the box's own px: the
    // canvas's visible client area intersected with the box. Scroll offset,
    // the error banner above the box and a capture shorter than the canvas
    // all fall out of the two rects.
    const view = canvas.getBoundingClientRect();
    const rect = box.getBoundingClientRect();
    const viewLo =
      axis === 'x'
        ? view.left + canvas.clientLeft
        : view.top + canvas.clientTop;
    const viewHi =
      viewLo + (axis === 'x' ? canvas.clientWidth : canvas.clientHeight);
    const boxLo = axis === 'x' ? rect.left : rect.top;
    const boxHi = axis === 'x' ? rect.right : rect.bottom;
    const lo = Math.max(viewLo, boxLo);
    const start = lo - boxLo;
    const size = Math.max(Math.min(viewHi, boxHi) - lo, 0);
    const guide: Guide = {
      id: annotationId('guide'),
      axis,
      pos: freeGuidePos(
        guides.filter((g) => g.axis === axis).map((g) => g.pos),
        start,
        size,
      ),
      color: guideColor,
    };
    setGuides((prev) => [...prev, guide]);
    setSelectedGuideId(guide.id);
  };

  const moveGuide = (id: string, pos: number) => {
    setGuides((prev) =>
      prev.map((guide) =>
        guide.id === id ? { ...guide, pos: clampGuide(pos, Infinity) } : guide,
      ),
    );
  };

  const deleteGuide = (id: string) => {
    setGuides((prev) => prev.filter((guide) => guide.id !== id));
    setSelectedGuideId((current) => (current === id ? null : current));
  };

  /** The well recolours the guide you have hold of, or the next one you drop. */
  const changeGuideColor = (color: string) => {
    setGuideColor(color);
    if (selectedGuideId === null) return;
    setGuides((prev) =>
      prev.map((guide) =>
        guide.id === selectedGuideId ? { ...guide, color } : guide,
      ),
    );
  };

  /**
   * Apply an edit from the settings modal. A viewport that is gone takes its
   * layers with it, on this page and every other page of the project — nothing
   * shows them any more, and a viewport added later must not inherit them.
   */
  const handleSettingsChange = (next: ViewportSettings) => {
    const removed = Object.keys(settings).filter((key) => !(key in next));
    setSettings(next);
    if (removed.length === 0) return;
    for (const key of removed) {
      const src = storedSlots[key]?.figmaSrc;
      if (src) releaseLayerUrl(src);
    }
    setSlots((prev) => {
      const rest = { ...prev };
      for (const key of removed) delete rest[key];
      return rest;
    });
    const pageIds = project.pages.map((entry) => entry.id);
    for (const key of removed) void clearViewport(pageIds, key);
  };

  /** Drop this page's captures and exports. Confirmed before it gets here. */
  const handleReset = () => {
    for (const slot of Object.values(slots)) {
      if (slot.figmaSrc) releaseLayerUrl(slot.figmaSrc);
    }
    setSlots(createSlots());
    setUploadError(null);
    void clearAll(pageId);
    setConfirming(null);
  };

  /**
   * Drop the database: every project, page, capture, export, snapshot and note
   * in this browser, and the stored site password with them.
   *
   * The reload is not a courtesy — this workspace was hydrated from records
   * that no longer exist, and the app has to come up again from an empty
   * database to be looking at the truth.
   */
  const handleResetEverything = () => {
    setConfirming(null);
    void (async () => {
      await deleteDatabase();
      window.location.reload();
    })();
  };

  const isCapturing = presets.some(
    (preset) => slots[preset.key].status === 'capturing',
  );
  const captureErrors = presets.filter(
    (preset) => slots[preset.key].error !== null,
  );
  // Clearing the banner clears what it reports: the upload message and every
  // slot's last capture error, so nothing comes back on the next render
  const dismissErrors = () => {
    setUploadError(null);
    setSlots((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(prev) as ViewportKey[]) {
        const slot = prev[key];
        if (slot.error === null) continue;
        next[key] = {
          ...slot,
          error: null,
          // The card's ✗ came from the same failure — clear both or it keeps
          // flagging an error whose message is gone
          status: slot.status === 'error' ? 'idle' : slot.status,
        };
      }
      return next;
    });
  };
  // A run can be one viewport or the whole set, so progress names what is in
  // flight rather than counting against a total the run never had
  const capturingLabels = presets
    .filter((preset) => slots[preset.key].status === 'capturing')
    .map((preset) => preset.label);
  // Either layer alone drives the canvas and the zoom controls; comparing needs
  // both of them stacked
  const isViewing =
    activeViewport !== null &&
    (activeSlot?.screenshot != null || activeSlot?.figmaSrc != null);
  const isComparing =
    isViewing && activeSlot?.screenshot != null && activeSlot.figmaSrc !== null;
  // Fit measures the capture, or the Figma export when nothing is captured yet
  const canFit = activeSlot?.screenshot != null || activeSlot?.figmaSrc != null;
  // The canvas stops scrolling and starts filling, but only once there is
  // something to fill it with — the empty state keeps its padded layout
  const sideBySideActive = viewMode === 'sideBySide' && isComparing;

  // Overlay, split and tap all scroll the canvas itself, with the capture
  // sitting CAPTURE_INSET in from its corner
  const handleCanvasScroll = () => {
    const canvas = canvasRef.current;
    if (!canvas || sideBySideActive) return;
    scrollPosRef.current = {
      top: Math.max(0, canvas.scrollTop - CAPTURE_INSET) / zoom,
      left: Math.max(0, canvas.scrollLeft - CAPTURE_INSET) / zoom,
    };
  };

  // Coming back from side by side, where the panes did the scrolling, or
  // zooming: put the canvas on the same spot of the capture. Before paint, so
  // no frame shows it parked at the top.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (sideBySideActive || !canvas) return;
    const { top, left } = scrollPosRef.current;
    canvas.scrollTop = top > 0 ? top * zoom + CAPTURE_INSET : 0;
    canvas.scrollLeft = left > 0 ? left * zoom + CAPTURE_INSET : 0;
  }, [sideBySideActive, zoom]);
  const activePreset =
    presets.find((preset) => preset.key === activeViewport) ?? null;
  const canCapture = url.trim() !== '' && !isCapturing && activePreset !== null;
  const canCaptureAllSites = url.trim() !== '' && !isCapturing;
  const captureBlockedReason =
    url.trim() === ''
      ? 'This page has no URL yet — set one under File ▸ Pages'
      : isCapturing
        ? 'A capture is already running'
        : null;
  const canExportAllFigma =
    !isExportingFigma &&
    presets.some((preset) => figmaTargetOf(preset.key) !== null);
  // Sub-pixel drift still rounds to 0px on screen, so the readout agrees
  const aligned = Math.round(offsetY) === 0;

  /**
   * Every command the app has, named once.
   *
   * The menu items and the accelerators below both dispatch from here, so a
   * command cannot end up meaning two things depending on how it was reached.
   */
  /**
   * Runs an "All" command straight away when it only fills empty viewports,
   * and asks first when it would replace captures or exports already there.
   */
  const runUnlessItOverwrites = (
    layer: PendingOverwrite['layer'],
    targets: ViewportPreset[],
    run: () => void,
  ) => {
    const replaced = targets.filter((preset) => {
      const slot = slotOf(slots, preset.key);
      return layer === 'site'
        ? slot.screenshot !== null
        : slot.figmaSrc !== null;
    });
    if (replaced.length === 0) {
      run();
      return;
    }
    setPendingOverwrite({
      layer,
      labels: replaced.map((preset) => preset.label),
      run,
    });
  };

  const commands = {
    // Browserless captures — no-ops while the cloud capture is switched off
    captureCurrent: () => {
      if (CLOUD_CAPTURE_ENABLED && canCapture) handleCaptureCurrent();
    },
    captureAll: () => {
      if (CLOUD_CAPTURE_ENABLED && url.trim() !== '' && !isCapturing)
        runUnlessItOverwrites('site', presets, () => handleCaptureAll());
    },
    captureCurrentLocal: () => {
      if (canCapture && localAvailable) handleCaptureCurrent({ local: true });
    },
    captureAllLocal: () => {
      if (url.trim() !== '' && !isCapturing && localAvailable)
        runUnlessItOverwrites('site', presets, () =>
          handleCaptureAll({ local: true }),
        );
    },
    // The Layers panel's All: the local browser when there is one
    captureAllSites: () => {
      if (canCaptureAllSites && (localAvailable || CLOUD_CAPTURE_ENABLED))
        runUnlessItOverwrites('site', presets, () =>
          handleCaptureAll({ local: localAvailable }),
        );
    },
    browserlessKey: () => {
      setKeyError(null);
      setKeyDialogOpen(true);
    },
    figmaCurrent: () => {
      if (activeViewport && figmaTargetOf(activeViewport))
        handleFigmaExport(activeViewport);
    },
    figmaAll: () => {
      if (!isExportingFigma)
        runUnlessItOverwrites(
          'figma',
          // Only the viewports with a link get a new export
          presets.filter((preset) => figmaTargetOf(preset.key) !== null),
          () => runFigmaExports(presets),
        );
    },
    figmaToken: () => {
      setFigmaTokenError(null);
      setFigmaDialogOpen(true);
    },
    addGuideV: () => addGuide('x'),
    addGuideH: () => addGuide('y'),
    togglePen: () => setTool((current) => (current === 'pen' ? 'none' : 'pen')),
    undoStroke: () => setStrokes((prev) => prev.slice(0, -1)),
    clearAnnotations: () => {
      setGuides([]);
      setStrokes([]);
      setSelectedGuideId(null);
    },
    importFigma: () => figmaInputRef.current?.click(),
    saveSnapshot: () => {
      if (activeSlot?.figmaSrc && activeViewport)
        void handleSaveSnapshot(activeViewport);
    },
    downloadDiff: () => {
      if (isComparing && !isDownloading) void handleDownloadDiff();
    },
    pages: () => setPagesOpen(true),
    projects: () => setProjectsModalOpen((open) => !open),
    newProject: () => setNewProjectOpen(true),
    exportProject: () => {
      if (!isTransferring) setExportDialogOpen(true);
    },
    importProject: () => {
      if (!isTransferring) projectInputRef.current?.click();
    },
    help: () => setHelpOpen(true),
    // A new tab keeps this session's guides, strokes and offset alive; when
    // the browser blocks it, say so instead of doing nothing
    docs: () => {
      if (!openDocs()) {
        setUploadError(
          `The documentation could not open in a new tab — allow pop-ups for this site, or visit ${DOCS_PATH} directly.`,
        );
      }
    },
    settingsPanel: () => setSettingsModalOpen((open) => !open),
    zoomIn: () => {
      if (isViewing) setZoom((z) => stepZoom(z, 1));
    },
    zoomOut: () => {
      if (isViewing) setZoom((z) => stepZoom(z, -1));
    },
    zoomFit: () => {
      if (canFit) zoomToFit();
    },
    zoomActual: () => {
      if (isViewing) setZoom(1);
    },
    toggleDrag: () => {
      if (isComparing) setFigmaDragEnabled((on) => !on);
    },
    toggleSyncScroll: () => setSyncScroll((on) => !on),
    toggleInspector: () => setShowInspector((on) => !on),
  };

  // The map is rebuilt every render and read through a ref, so one subscription
  // lasts the session and still dispatches against current state
  const commandsRef = useRef(commands);
  useEffect(() => {
    commandsRef.current = commands;
  });

  // A drag that ends anywhere — dropped on the window chrome, cancelled with
  // Escape — takes the canvas hover state with it. Without this a drag let go
  // outside the canvas leaves the drop outline up with nothing dragging.
  useEffect(() => {
    if (!canvasDrop) return;
    const clear = () => setCanvasDrop(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, [canvasDrop]);

  // A file let go anywhere but a drop zone — the menu bar, the inspector, a
  // gap between panels — would make the browser open it in place of the app,
  // losing the session. Swallowed here; the drop zones handle their own.
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);
    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  useEffect(() => {
    modalRef.current =
      pagesOpen ||
      newProjectOpen ||
      settingsModalOpen ||
      projectsModalOpen ||
      keyDialogOpen ||
      figmaDialogOpen ||
      exportDialogOpen ||
      helpOpen ||
      confirming !== null ||
      pendingOverwrite !== null;
  });

  /**
   * The menu accelerators.
   *
   * Plain keys for everything that is harmless or undoable: this is a canvas
   * app, and every one of them is printed beside the menu item it fires.
   * Commands that replace a layer — capture, Figma export — need Shift, so a
   * stray key cannot overwrite a good capture; the "All" variants have no key
   * at all and are reached from the menu or the Layers panel only.
   * Typing anywhere keeps them off.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || modalRef.current) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      const c = commandsRef.current;
      switch (e.key) {
        // Capture this viewport — ⇧C. Checked on shiftKey, not just on the
        // capital letter, so Caps Lock alone never fires it
        case 'C':
          if (!e.shiftKey) return;
          return run(c.captureCurrent);
        // The digits are whatever VIEW_MODES advertises, so the menu's
        // accelerators and the keyboard can never drift apart
        case '1':
        case '2':
        case '3':
        case '4': {
          const mode = VIEW_MODES.find((m) => m.shortcut === e.key);
          if (!mode) return;
          return run(() => setViewMode(mode.value));
        }
        case '+':
        case '=':
          return run(c.zoomIn);
        case '-':
        case '_':
          return run(c.zoomOut);
        case 'f':
          return run(c.zoomFit);
        case '0':
          return run(c.zoomActual);
        case 'v':
          return run(c.toggleDrag);
        case 'b':
          return run(c.toggleInspector);
        case 'p':
          return run(c.pages);
        case 'P':
          return run(c.projects);
        case 'n':
          return run(c.newProject);
        case ',':
          return run(c.settingsPanel);
        case 'i':
          return run(c.importFigma);
        case 'e':
          return run(c.downloadDiff);
        case 's':
          return run(c.saveSnapshot);
        // Capture this viewport with the browser on this machine — ⇧L
        case 'L':
          if (!e.shiftKey) return;
          return run(c.captureCurrentLocal);
        // Export this viewport's Figma frame — ⇧M
        case 'M':
          if (!e.shiftKey) return;
          return run(c.figmaCurrent);
        // The annotation tools
        case 'g':
          return run(c.addGuideV);
        case 'G':
          return run(c.addGuideH);
        case 'd':
          return run(c.togglePen);
        case 'z':
          return run(c.undoStroke);
        // Shift-/ on most layouts; e.key reports the character, not the chord
        case '?':
          return run(c.help);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * The menu bar: File makes and moves things, Align moves the Figma layer,
   * View composites it, Capture runs the browser. Nothing lives in two menus.
   */
  const menus: Menu[] = [
    {
      id: 'file',
      label: 'File',
      entries: [
        { label: 'New project…', shortcut: 'N', onSelect: commands.newProject },
        { kind: 'separator' },
        { label: 'Pages…', shortcut: 'P', onSelect: commands.pages },
        {
          label: 'Projects…',
          shortcut: '⇧P',
          onSelect: commands.projects,
          checked: projectsModalOpen,
        },
        {
          label: isTransferring ? 'Packing project…' : 'Export project as ZIP…',
          title:
            'Every page, capture, Figma export, snapshot and note of this project, in one file to hand over',
          disabled: isTransferring,
          onSelect: commands.exportProject,
        },
        {
          label: 'Import project from ZIP…',
          title: 'Open a ZIP made by Export project as a new project',
          disabled: isTransferring,
          onSelect: commands.importProject,
        },
        { kind: 'separator' },
        {
          label: isDownloading ? 'Preparing diff map…' : 'Download diff map',
          shortcut: 'E',
          disabled: !isComparing || isDownloading,
          onSelect: commands.downloadDiff,
        },
        { kind: 'separator' },
        {
          label: 'Reset this page…',
          title: 'Drop every capture and export on this page',
          danger: true,
          onSelect: () => setConfirming('page'),
        },
        {
          label: 'Reset everything…',
          title:
            'Delete every project, page, capture, export, snapshot and note in this browser',
          danger: true,
          onSelect: () => setConfirming('everything'),
        },
      ],
    },
    {
      id: 'align',
      label: 'Align',
      entries: [
        {
          label: 'Move Figma up 1px',
          shortcut: '↑',
          disabled: !isComparing,
          onSelect: () => nudgeFigma(-1),
        },
        {
          label: 'Move Figma down 1px',
          shortcut: '↓',
          disabled: !isComparing,
          onSelect: () => nudgeFigma(1),
        },
        {
          label: 'Move Figma up 10px',
          shortcut: '⇧↑',
          disabled: !isComparing,
          onSelect: () => nudgeFigma(-10),
        },
        {
          label: 'Move Figma down 10px',
          shortcut: '⇧↓',
          disabled: !isComparing,
          onSelect: () => nudgeFigma(10),
        },
        { kind: 'separator' },
        {
          label: 'Align to top',
          disabled: !isComparing,
          checked: isComparing && aligned,
          onSelect: () => alignFigma(0),
        },
        {
          label: 'Align to bottom',
          disabled: !isComparing || screenshotHeight === null,
          onSelect: () =>
            screenshotHeight !== null &&
            alignFigma(bottomAlignOffset(screenshotHeight, figmaHeight)),
        },
        { kind: 'separator' },
        {
          label: 'Drag moves the Figma layer',
          shortcut: 'V',
          marker: 'check',
          checked: figmaDragEnabled,
          disabled: !isComparing,
          onSelect: commands.toggleDrag,
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      entries: [
        ...VIEW_MODES.map((mode) => ({
          label: mode.label,
          shortcut: mode.shortcut,
          marker: 'radio' as const,
          checked: viewMode === mode.value,
          onSelect: () => setViewMode(mode.value),
        })),
        { kind: 'separator' },
        {
          label: 'Zoom in',
          shortcut: '+',
          disabled: !isViewing || zoom >= MAX_ZOOM,
          onSelect: commands.zoomIn,
        },
        {
          label: 'Zoom out',
          shortcut: '−',
          disabled: !isViewing || zoom <= MIN_ZOOM,
          onSelect: commands.zoomOut,
        },
        {
          label: 'Zoom to fit',
          shortcut: 'F',
          disabled: !canFit,
          onSelect: commands.zoomFit,
        },
        {
          label: 'Actual size',
          shortcut: '0',
          disabled: !isViewing || zoom === 1,
          onSelect: commands.zoomActual,
        },
        { kind: 'separator' },
        {
          label: 'Sync scroll side by side',
          marker: 'check',
          checked: syncScroll,
          disabled: viewMode !== 'sideBySide',
          onSelect: commands.toggleSyncScroll,
        },
        {
          label: 'Show inspector',
          shortcut: 'B',
          marker: 'check',
          checked: showInspector,
          onSelect: commands.toggleInspector,
        },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      entries: [
        {
          label: 'Add vertical guide',
          shortcut: 'G',
          onSelect: commands.addGuideV,
        },
        {
          label: 'Add horizontal guide',
          shortcut: '⇧G',
          onSelect: commands.addGuideH,
        },
        {
          label: 'Remove selected guide',
          disabled: selectedGuideId === null,
          onSelect: () => selectedGuideId && deleteGuide(selectedGuideId),
        },
        { kind: 'separator' },
        {
          label: 'Pen',
          shortcut: 'D',
          marker: 'check',
          checked: tool === 'pen',
          onSelect: commands.togglePen,
        },
        {
          label: 'Undo last stroke',
          shortcut: 'Z',
          disabled: strokes.length === 0,
          onSelect: commands.undoStroke,
        },
        { kind: 'separator' },
        {
          label: 'Clear guides and drawings',
          disabled: guides.length === 0 && strokes.length === 0,
          onSelect: commands.clearAnnotations,
        },
      ],
    },
    {
      id: 'capture',
      label: 'Capture',
      entries: [
        // Browserless captures, only while the cloud capture is switched on
        ...(CLOUD_CAPTURE_ENABLED
          ? ([
              {
                label: activePreset
                  ? `Capture ${activePreset.label}`
                  : 'Capture this viewport',
                shortcut: '⇧C',
                disabled: !canCapture,
                onSelect: commands.captureCurrent,
              },
              {
                label: `Capture all ${presets.length} enabled viewports`,
                disabled: url.trim() === '' || isCapturing,
                onSelect: commands.captureAll,
              },
              { kind: 'separator' },
            ] as Menu['entries'])
          : []),
        // Only this machine can offer its own browser, and only it needs no key
        ...(localAvailable
          ? ([
              {
                label: activePreset
                  ? `Capture ${activePreset.label} on this machine`
                  : 'Capture this viewport on this machine',
                shortcut: '⇧L',
                disabled: !canCapture,
                onSelect: commands.captureCurrentLocal,
              },
              {
                label: 'Capture all on this machine',
                disabled: url.trim() === '' || isCapturing,
                onSelect: commands.captureAllLocal,
              },
              { kind: 'separator' },
            ] as Menu['entries'])
          : []),
        ...(CLOUD_CAPTURE_ENABLED && source === 'key'
          ? ([
              {
                label: 'Browserless key…',
                checked: hasKey,
                onSelect: commands.browserlessKey,
              },
              { kind: 'separator' },
            ] as Menu['entries'])
          : []),
        {
          label: activePreset
            ? `Export ${activePreset.label} Figma frame at ${renderScaleFor(activePreset.width)}x`
            : "Export this viewport's Figma frame",
          shortcut: '⇧M',
          disabled:
            activeViewport === null ||
            figmaTargetOf(activeViewport) === null ||
            figmaBusy[activeViewport] === true,
          onSelect: commands.figmaCurrent,
        },
        {
          label: 'Export every Figma frame',
          disabled:
            isExportingFigma ||
            !presets.some((preset) => figmaTargetOf(preset.key) !== null),
          onSelect: commands.figmaAll,
        },
        ...(figmaSource === 'key'
          ? ([
              {
                label: 'Figma token…',
                checked: hasFigmaToken,
                onSelect: commands.figmaToken,
              },
            ] as Menu['entries'])
          : []),
        { kind: 'separator' },
        { kind: 'heading', label: 'Go to viewport' },
        ...presets.map((preset) => ({
          label: `${preset.label} — ${preset.width}×${preset.height}`,
          marker: 'radio' as const,
          checked: activeViewport === preset.key,
          onSelect: () => setPreferredViewport(preset.key),
        })),
        { kind: 'separator' },
        {
          label: 'Viewport settings…',
          shortcut: ',',
          checked: settingsModalOpen,
          onSelect: commands.settingsPanel,
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      entries: [
        {
          label: 'Keyboard shortcuts',
          shortcut: '?',
          checked: helpOpen,
          onSelect: commands.help,
        },
        { kind: 'separator' },
        {
          label: 'Documentation',
          title: 'Opens the docs in a new tab',
          onSelect: commands.docs,
        },
      ],
    },
  ];

  // A capture or a Figma export is running: the whole workspace is locked
  // behind the overlay until it ends, so nothing can move the page under it
  const isBusy = isCapturing || isExportingFigma;
  const figmaLabels = presets
    .filter((preset) => figmaBusy[preset.key] === true)
    .map((preset) => preset.label);
  const busyTitle = [
    capturingLabels.length > 0
      ? `Capturing ${capturingLabels.join(', ')}`
      : null,
    figmaLabels.length > 0 ? `Rendering Figma ${figmaLabels.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <CaptureOverlay
        open={isBusy}
        title={busyTitle || 'Working…'}
        onStop={handleStopRuns}
      >
        <ViewportStatusList
          presets={presets}
          slots={slots}
          figmaBusy={figmaBusy}
        />
      </CaptureOverlay>
      {/* inert: no focus, clicks or keys reach the workspace while it is busy */}
      <div
        inert={isBusy}
        className="flex min-h-0 w-full flex-1 flex-col bg-ink-void"
      >
        {/* The application menu bar — every command in the app lives in it, and
          the one control that stays out is the one you reach for constantly */}
        <MenuBar
          menus={menus}
          brand={
            <span className="mr-2 flex items-center gap-2">
              <BrandMark size={16} className="shrink-0 text-ink-400" />
              {/* The wordmark steps back a shade so the project/page title in
                the middle of the bar reads first */}
              <span className="hidden font-display text-[11px] font-extrabold tracking-[0.16em] text-ink-400 uppercase sm:inline">
                Pixel Perfect
              </span>
            </span>
          }
          title={
            <PageSwitcher
              projectName={project.name}
              pages={project.pages}
              activeId={pageId}
              onSelect={onSelectPage}
              onRename={onRenamePage}
              onManage={() => setPagesOpen(true)}
            />
          }
          // Capture lives in the Layers panel and the Capture menu — the bar
          // keeps commands, not buttons
          actions={
            <>
              {isCapturing && (
                <span className="text-[11px] text-press-cyan">
                  capturing {capturingLabels.join(', ')}…
                </span>
              )}
              {/* The project's source, always one click away */}
              <a
                href={SITE.githubUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Pixel Perfect on GitHub"
                title="Pixel Perfect on GitHub"
                className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100"
              >
                <GitHubIcon size={16} />
              </a>
            </>
          }
        />

        {/* The I accelerator — the drop zone's picker, off the keyboard */}
        <input
          ref={figmaInputRef}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void handleFigmaFilesChange(files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* The Layers panel's site upload — any number of screenshots, each
          routed to the viewport its width belongs to */}
        <input
          ref={siteInputRef}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void handleScreenshotFilesChange(files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* File ▸ Import project — a ZIP from File ▸ Export project */}
        <input
          ref={projectInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportProject(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Every menu command that needs a surface opens it in the middle of the
          window — one dialog shape for the whole app */}
        <Modal
          open={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="Viewport settings"
          subtitle={project.name}
        >
          <SettingsPanel
            settings={settings}
            onChange={handleSettingsChange}
            slots={slots}
          />
        </Modal>

        <Modal
          open={projectsModalOpen}
          onClose={() => setProjectsModalOpen(false)}
          title="Projects"
          subtitle={`${projects.length}`}
        >
          <ProjectsPanel
            projects={projects}
            activeId={projectId}
            onSelect={(id) => {
              setProjectsModalOpen(false);
              onSelectProject(id);
            }}
            onCreate={onCreateProject}
            onRename={onRenameProject}
            onDelete={onDeleteProject}
          />
        </Modal>

        <PagesGallery
          open={pagesOpen}
          onClose={() => setPagesOpen(false)}
          projectName={project.name}
          pages={project.pages}
          activeId={pageId}
          onSelect={(id) => {
            setPagesOpen(false);
            onSelectPage(id);
          }}
          onCreate={onCreatePage}
          onRename={onRenamePage}
          onDelete={onDeletePage}
          onUrlChange={onUrlChange}
          onSitePasswordChange={onSitePasswordChange}
          presets={presets}
          onFigmaUrlChange={onFigmaUrlChange}
        />

        <NewProjectDialog
          open={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          onCreate={onCreateProject}
        />

        {/* Where the user's own Browserless key is typed, when this deployment
          carries none of its own */}
        {keyDialogOpen && (
          <BrowserlessKeyDialog
            open
            onClose={() => setKeyDialogOpen(false)}
            error={keyError}
            onSaved={() => setKeyError(null)}
          />
        )}

        {/* Where the user's own Figma token is typed, when this deployment
          carries none of its own */}
        {figmaDialogOpen && (
          <FigmaTokenDialog
            open
            onClose={() => setFigmaDialogOpen(false)}
            error={figmaTokenError}
            onSaved={() => setFigmaTokenError(null)}
          />
        )}

        <HelpDialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          localCapture={localAvailable}
        />

        <ExportProjectDialog
          open={exportDialogOpen}
          projectName={project.name}
          onExport={(options) => void handleExportProject(options)}
          onCancel={() => setExportDialogOpen(false)}
        />

        <ConfirmDialog
          open={confirming === 'page'}
          title="Reset this page"
          danger
          confirmLabel="Reset page"
          message={
            <>
              Every capture and Figma export on{' '}
              <span className="font-medium text-ink-100">{page.name}</span> is
              dropped. Its notes, its saved snapshots and every other page stay
              as they are.
            </>
          }
          onConfirm={handleReset}
          onCancel={() => setConfirming(null)}
        />

        {/* The one command in the app that empties the browser. It asks for the
          phrase in full: there is no undo behind it and nothing on a server to
          restore from. */}
        <ConfirmDialog
          open={confirming === 'everything'}
          title="Reset everything"
          danger
          confirmLabel="Delete everything"
          passkey={RESET_PASSKEY}
          message={
            <>
              This deletes the whole local database:{' '}
              <span className="font-medium text-ink-100">
                every project, page, capture, Figma export, snapshot and note
              </span>{' '}
              this browser holds, and the saved site password with them. It
              cannot be undone — none of it exists anywhere else. The app
              reloads empty.
            </>
          }
          onConfirm={handleResetEverything}
          onCancel={() => setConfirming(null)}
        />

        {/* An "All" run that would replace layers already in place */}
        <ConfirmDialog
          open={pendingOverwrite !== null}
          title={
            pendingOverwrite?.layer === 'figma'
              ? 'Replace Figma exports'
              : 'Replace site captures'
          }
          danger
          confirmLabel={`Replace ${pendingOverwrite?.labels.length ?? 0}`}
          message={
            pendingOverwrite?.layer === 'figma' ? (
              <>
                <span className="font-medium text-ink-100">
                  {pendingOverwrite.labels.join(', ')}
                </span>{' '}
                already {pendingOverwrite.labels.length === 1 ? 'has' : 'have'}{' '}
                a Figma export. Exporting again replaces{' '}
                {pendingOverwrite.labels.length === 1 ? 'it' : 'them'}; save a
                snapshot in History first to keep the current version.
              </>
            ) : pendingOverwrite ? (
              <>
                <span className="font-medium text-ink-100">
                  {pendingOverwrite.labels.join(', ')}
                </span>{' '}
                already {pendingOverwrite.labels.length === 1 ? 'has' : 'have'}{' '}
                a site capture. Capturing again replaces{' '}
                {pendingOverwrite.labels.length === 1 ? 'it' : 'them'} — if the
                page answers with something unexpected (a password page, an
                error, a cookie wall), the current captures are lost.
              </>
            ) : null
          }
          onConfirm={() => {
            const run = pendingOverwrite?.run;
            setPendingOverwrite(null);
            run?.();
          }}
          onCancel={() => setPendingOverwrite(null)}
        />

        {/* Narrow screens stack the inspector above the canvas and scroll the
          pair; from lg the two sit side by side and each scrolls on its own. */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {showInspector && (
            <ControlPanel
              activeViewport={isViewing ? activeViewport : null}
              layers={
                activePreset && activeSlot
                  ? {
                      preset: activePreset,
                      slot: activeSlot,
                      figmaLinked: figmaTargetOf(activePreset.key) !== null,
                      figmaBusy: figmaBusy[activePreset.key] === true,
                      showLocalCapture: localAvailable,
                      showCloudCapture: CLOUD_CAPTURE_ENABLED,
                      captureBlockedReason,
                      figmaAllBlockedReason: canExportAllFigma
                        ? null
                        : isExportingFigma
                          ? 'Figma is already rendering'
                          : 'No viewport has a Figma frame link — set them under File ▸ Pages',
                      siteAllBlockedReason: captureBlockedReason,
                    }
                  : null
              }
              onCapture={commands.captureCurrent}
              onExportAllFigma={() => canExportAllFigma && commands.figmaAll()}
              onCaptureAllSites={commands.captureAllSites}
              onCaptureLocal={commands.captureCurrentLocal}
              onExportFigma={() =>
                activeViewport && handleFigmaExport(activeViewport)
              }
              onUploadFigma={() => figmaInputRef.current?.click()}
              onUploadSite={() => siteInputRef.current?.click()}
              onRemoveFigma={() =>
                activeViewport && handleRemoveFigma(activeViewport)
              }
              onRemoveScreenshot={() =>
                activeViewport && handleRemoveScreenshot(activeViewport)
              }
              opacity={opacity}
              onOpacityChange={setOpacity}
              blendMode={blendMode}
              onBlendModeChange={setBlendMode}
              notes={notes}
              onNotesChange={setNotes}
              notesFor={page.name}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              syncScroll={syncScroll}
              onSyncScrollChange={setSyncScroll}
              offsetY={offsetY}
              onOffsetYChange={setOffsetY}
              screenshotHeight={screenshotHeight}
              figmaHeight={figmaHeight}
              zoom={zoom}
              onZoomChange={(next) => setZoom(clampZoom(next))}
              onZoomStep={(dir) => setZoom((z) => stepZoom(z, dir))}
              onZoomFit={zoomToFit}
              canFit={canFit}
              isViewing={isViewing}
              figmaDragEnabled={figmaDragEnabled}
              onFigmaDragChange={setFigmaDragEnabled}
              canDragFigma={isComparing}
              tool={tool}
              onToolChange={setTool}
              guides={guides}
              guideColor={guideColor}
              onGuideColorChange={changeGuideColor}
              onAddGuide={addGuide}
              selectedGuideId={selectedGuideId}
              onDeleteGuide={deleteGuide}
              penColor={penColor}
              onPenColorChange={setPenColor}
              penWidth={penWidth}
              onPenWidthChange={setPenWidth}
              strokeCount={strokes.length}
              onUndoStroke={commands.undoStroke}
              onClearAnnotations={commands.clearAnnotations}
              history={history}
              viewportLabels={labels}
              onSaveSnapshot={commands.saveSnapshot}
              onLoadSnapshot={handleLoadSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onRenameSnapshot={handleRenameSnapshot}
              canSaveSnapshot={activeSlot?.figmaSrc != null}
              saveSnapshotHint={
                activeSlot?.figmaSrc
                  ? null
                  : 'Nothing to archive — this viewport has no Figma export.'
              }
            />
          )}

          <div className="flex min-h-[70vh] min-w-0 flex-1 flex-col lg:min-h-0">
            {/* One tab per viewport, named by its size — its layers are
              fetched and dropped from the Layers panel */}
            <ViewportCards
              presets={presets}
              active={activeViewport}
              onSelect={setPreferredViewport}
              onDropFigma={handleFigmaDropOn}
              onDropSite={handleScreenshotDrop}
              onDropRejected={(transfer) =>
                setUploadError(notAnImageError(transfer))
              }
            />

            {/* The drop outline lives beside the canvas, not inside it: inside,
              it scrolled away with the capture and a drop on a scrolled canvas
              showed nothing at all */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <main
                ref={canvasRef}
                onScroll={handleCanvasScroll}
                // Dropping on the canvas puts the export on the viewport the canvas
                // is showing — the layer appears where it was aimed
                onDragOver={(e) => {
                  if (!activeViewport || !hasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  const side = dropSide(e.currentTarget, e.clientX);
                  // dragover fires every few ms: only re-render on a change
                  if (side !== canvasDrop) setCanvasDrop(side);
                }}
                onDragLeave={(e) => {
                  // Crossing onto a child fires leave on the parent; ignore those
                  if (e.currentTarget.contains(e.relatedTarget as Node | null))
                    return;
                  setCanvasDrop(null);
                }}
                onDrop={(e) => {
                  if (!hasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  setCanvasDrop(null);
                  if (!activeViewport) return;
                  // Read from where the file was let go, not from the hover
                  // state: a quick drop can land before that state has rendered
                  const side = dropSide(e.currentTarget, e.clientX);
                  const [file] = imageFiles(e.dataTransfer);
                  if (!file) {
                    setUploadError(notAnImageError(e.dataTransfer));
                    return;
                  }
                  if (side === 'site') {
                    void handleScreenshotDrop(activeViewport, file);
                  } else {
                    void handleFigmaDropOn(activeViewport, file);
                  }
                }}
                className={`relative flex-1 ${
                  sideBySideActive
                    ? 'flex flex-col overflow-hidden'
                    : 'overflow-auto'
                }`}
              >
                {(uploadError || captureErrors.length > 0) && (
                  <div
                    role="alert"
                    className="sticky top-0 z-20 flex items-start gap-3 border-b border-press-red/40 bg-press-red/10 px-4 py-2 text-sm text-press-red"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {uploadError && <span>{uploadError}</span>}
                      {captureErrors.map((preset) => (
                        <span key={preset.key}>
                          {preset.label}: {slots[preset.key].error}
                        </span>
                      ))}
                    </div>
                    {/* Read it, put it away — the banner is a notice, not a state
                      you have to capture your way out of */}
                    <button
                      type="button"
                      onClick={dismissErrors}
                      aria-label="Dismiss errors"
                      title="Dismiss"
                      className="-mr-1 shrink-0 rounded p-1 text-press-red/70 transition-colors hover:bg-press-red/20 hover:text-press-red"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* `w-fit min-w-full` so the wrapper grows with a zoomed capture
                  rather than stopping at the scrollport — the annotation layer
                  fills this box, and a mark has to be able to land anywhere the
                  capture reaches */}
                <div
                  ref={annotationBoxRef}
                  className={`relative ${
                    sideBySideActive ? 'min-h-0 flex-1' : 'w-fit min-w-full p-6'
                  }`}
                >
                  {isViewing && activeSlot ? (
                    sideBySideActive &&
                    activeSlot.screenshot &&
                    activeSlot.figmaSrc ? (
                      <SideBySideViewer
                        screenshotSrc={activeSlot.screenshot.image}
                        figmaSrc={activeSlot.figmaSrc}
                        screenshotWidth={activeSlot.screenshot.width}
                        screenshotHeight={activeSlot.screenshot.height}
                        figmaHeight={activeSlot.figmaHeight}
                        zoom={zoom}
                        offsetY={activeSlot.offsetY}
                        syncScroll={syncScroll}
                        figmaDragEnabled={figmaDragEnabled}
                        scrollPosRef={scrollPosRef}
                        onOffsetYChange={setOffsetY}
                        onFigmaHeightChange={setFigmaHeight}
                      />
                    ) : (
                      <div className="inline-block border border-ink-800 bg-ink-900 shadow-2xl">
                        <ComparisonViewer
                          screenshotSrc={activeSlot.screenshot?.image ?? null}
                          figmaSrc={activeSlot.figmaSrc}
                          screenshotWidth={activeSlot.screenshot?.width ?? null}
                          screenshotHeight={
                            activeSlot.screenshot?.height ?? null
                          }
                          opacity={opacity}
                          blendMode={blendMode}
                          viewMode={viewMode}
                          offsetY={activeSlot.offsetY}
                          zoom={zoom}
                          figmaDragEnabled={figmaDragEnabled}
                          scrollRef={canvasRef}
                          onOffsetYChange={setOffsetY}
                          onFigmaHeightChange={setFigmaHeight}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex h-[70vh] items-center justify-center">
                      <div className="w-full max-w-sm text-center">
                        {/* The mark sits out of register: nothing is lined up yet */}
                        <RegistrationMark
                          size={80}
                          className="mx-auto mb-5 text-ink-700"
                        />
                        <p className="mb-6 text-sm leading-6 text-ink-400">
                          {isCapturing
                            ? `Capturing ${capturingLabels.join(', ')}…`
                            : url.trim() === ''
                              ? `Give “${page.name}” a URL under File ▸ Pages, then capture it from the Layers panel. Drop a Figma export on the left half and it becomes this viewport's layer.`
                              : `Capture the site from the Layers panel, or every viewport from the Capture menu. Drop a Figma export on the left half and it becomes this viewport's layer.`}
                        </p>
                        <ViewportStatusList
                          presets={presets}
                          slots={slots}
                          figmaBusy={figmaBusy}
                        />
                      </div>
                    </div>
                  )}

                  {/* Guides and freehand marks, over whatever the canvas is showing
                    — a plate of its own, belonging to neither layer */}
                  <AnnotationLayer
                    tool={tool}
                    guides={guides}
                    strokes={strokes}
                    penColor={penColor}
                    penWidth={penWidth}
                    selectedGuideId={selectedGuideId}
                    onMoveGuide={moveGuide}
                    onDeleteGuide={deleteGuide}
                    onSelectGuide={setSelectedGuideId}
                    onAddStroke={(stroke) =>
                      setStrokes((prev) => [...prev, stroke])
                    }
                  />
                </div>
              </main>
              {canvasDrop && activePreset && (
                <div className="pointer-events-none absolute inset-2 z-30 flex gap-2 bg-ink-950/60 backdrop-blur-[2px]">
                  {/* Left half takes the Figma export, right half the site
                      screenshot — the same sides the split view puts them on */}
                  {(
                    [
                      {
                        side: 'figma',
                        title: 'Figma',
                        hint: 'Drop the design export',
                        border: 'border-press-magenta',
                        idle: 'border-press-magenta/30 bg-press-magenta/5',
                        hover: 'bg-press-magenta/15',
                        text: 'text-press-magenta',
                      },
                      {
                        side: 'site',
                        title: 'Site',
                        hint: 'Drop the site screenshot',
                        border: 'border-press-cyan',
                        idle: 'border-press-cyan/30 bg-press-cyan/5',
                        hover: 'bg-press-cyan/15',
                        text: 'text-press-cyan',
                      },
                    ] as const
                  ).map((zone) => {
                    const on = canvasDrop === zone.side;
                    return (
                      <div
                        key={zone.side}
                        className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center transition-all duration-150 ${
                          on ? `${zone.border} ${zone.hover}` : zone.idle
                        }`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-10 w-10 transition-transform duration-150 ${zone.text} ${
                            on ? 'translate-y-1 opacity-100' : 'opacity-40'
                          }`}
                        >
                          <path d="M12 4v11" />
                          <path d="m7 10 5 5 5-5" />
                          <path d="M5 19h14" />
                        </svg>
                        <span
                          className={`text-3xl font-semibold tracking-tight transition-opacity duration-150 ${zone.text} ${
                            on ? 'opacity-100' : 'opacity-40'
                          }`}
                        >
                          {zone.title}
                        </span>
                        <span
                          className={`text-xs transition-opacity duration-150 ${
                            on
                              ? 'text-ink-200 opacity-100'
                              : 'text-ink-400 opacity-60'
                          }`}
                        >
                          {zone.hint}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-opacity duration-150 ${
                            on
                              ? `${zone.border} ${zone.text} opacity-100`
                              : 'border-ink-700 text-ink-500 opacity-60'
                          }`}
                        >
                          {activePreset.label} · {activePreset.width}×
                          {activePreset.height}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status bar — reads out, never acts. Everything it reports is set
              from the menus or the inspector. */}
            <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-800 bg-ink-900 px-4 py-1.5 text-[11px]">
              <span
                className="font-mono text-ink-300 tabular-nums"
                title="Zoom"
              >
                {Math.round(zoom * 100)}%
              </span>
              <span className="h-3 w-px bg-ink-700" aria-hidden="true" />
              {activeSlot?.figmaFileName ? (
                <span
                  className="max-w-64 truncate text-press-magenta"
                  title={activeSlot.figmaFileName}
                >
                  {activeSlot.figmaFileName}
                </span>
              ) : (
                <span className="text-ink-600">no export</span>
              )}
              {activeSlot?.screenshot ? (
                <span className="font-mono text-press-cyan tabular-nums">
                  {activeSlot.screenshot.width}×{activeSlot.screenshot.height}
                </span>
              ) : (
                <span className="text-ink-600">no capture</span>
              )}
              {isComparing && (
                <span
                  className={`font-mono tabular-nums ${
                    aligned ? 'text-press-violet' : 'text-ink-300'
                  }`}
                  title="How far the Figma layer sits from the capture, vertically"
                >
                  offset {offsetY > 0 ? '+' : ''}
                  {Math.round(offsetY)}px
                </span>
              )}

              <span className="ml-auto flex items-center gap-4">
                {isCapturing && (
                  <span className="text-press-cyan">
                    capturing {capturingLabels.join(', ')}…
                  </span>
                )}
                {tool === 'pen' && (
                  <span className="text-press-amber" title="Tools ▸ Pen (D)">
                    <span aria-hidden="true">✎ </span>pen
                  </span>
                )}
                {/* Which browser this page's captures come from */}
                <span
                  className="text-ink-500"
                  title="Where the browser a capture runs in comes from"
                >
                  {lastBrowser === 'local'
                    ? 'local browser'
                    : source === 'env'
                      ? 'browserless (env)'
                      : hasKey
                        ? 'browserless (key)'
                        : 'no browserless key'}
                </span>
                <span
                  className={
                    figmaDragEnabled ? 'text-press-magenta' : 'text-ink-500'
                  }
                  title="Align ▸ Drag moves the Figma layer (V)"
                >
                  <span aria-hidden="true">
                    {figmaDragEnabled ? '↕ ' : '✥ '}
                  </span>
                  {figmaDragEnabled ? 'drag moves Figma' : 'drag pans canvas'}
                </span>
              </span>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}
