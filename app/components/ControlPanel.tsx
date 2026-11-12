'use client';

import { useState, type ReactNode } from 'react';
import SnapshotHistory from './SnapshotHistory';
import type { Tool } from './AnnotationLayer';
import { PEN_WIDTHS, type Guide, type GuideAxis } from '@/lib/annotations';
import { bottomAlignOffset, clampOffset } from '@/lib/offset';
import type { HistoryEntry } from '@/lib/storage';
import { BLEND_MODES, type BlendMode, type ViewMode } from '@/lib/types';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, ZOOM_STEPS } from '@/lib/zoom';
import { docsHref, PANEL_DOCS, type PanelTitle } from '@/lib/docs';
import {
  type ViewportKey,
  type ViewportPreset,
  type ViewportSlot,
} from '@/lib/viewports';
import { APP_VERSION } from '@/lib/version';

/** The selected viewport's two layers, and what can be done to each. */
export interface LayersState {
  preset: ViewportPreset;
  slot: ViewportSlot;
  /** The page has a readable Figma frame link for this viewport */
  figmaLinked: boolean;
  /** Figma is rendering this viewport's frame right now */
  figmaBusy: boolean;
  /** Only on localhost is there a browser here to offer */
  showLocalCapture: boolean;
  /** Browserless capture is offered — off while CLOUD_CAPTURE_ENABLED is */
  showCloudCapture: boolean;
  /** Why capture is unavailable, null when it is */
  captureBlockedReason: string | null;
  /** Why All on the Figma row has nothing to do, null when it has */
  figmaAllBlockedReason: string | null;
  /** Why All on the site row cannot run, null when it can */
  siteAllBlockedReason: string | null;
}

export interface ControlPanelProps {
  activeViewport: ViewportKey | null;
  /** ── Layers: fetch, refetch and drop the selected viewport's plates ────── */
  layers: LayersState | null;
  onCapture: () => void;
  onCaptureLocal: () => void;
  /** Every viewport's Figma frame */
  onExportAllFigma: () => void;
  /** Every viewport's site capture */
  onCaptureAllSites: () => void;
  onExportFigma: () => void;
  /** Open the picker for Figma exports — routed to viewports by width */
  onUploadFigma: () => void;
  /** Open the picker for site screenshots — routed to viewports by width */
  onUploadSite: () => void;
  onRemoveFigma: () => void;
  onRemoveScreenshot: () => void;
  opacity: number; // 0-100
  onOpacityChange: (opacity: number) => void;
  blendMode: BlendMode;
  onBlendModeChange: (mode: BlendMode) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  /** The page these notes belong to — they are kept per page, not per project. */
  notesFor: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  syncScroll: boolean;
  onSyncScrollChange: (on: boolean) => void;
  offsetY: number;
  onOffsetYChange: (offsetY: number) => void;
  screenshotHeight: number | null;
  figmaHeight: number | null;
  /** ── Zoom: the whole of it lives in this panel ─────────────────────────── */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomStep: (dir: 1 | -1) => void;
  onZoomFit: () => void;
  /** Fit measures the capture (or the Figma export), so it needs a layer */
  canFit: boolean;
  /** Something is on the canvas — without it the zoom controls do nothing */
  isViewing: boolean;
  /** ── The drag tool: pan the canvas, or move the Figma layer ────────────── */
  figmaDragEnabled: boolean;
  onFigmaDragChange: (on: boolean) => void;
  /** Moving the Figma layer needs both layers stacked on one canvas */
  canDragFigma: boolean;
  /** ── Tools: guides and the pen, drawn over both layers ─────────────────── */
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  guides: Guide[];
  guideColor: string;
  onGuideColorChange: (color: string) => void;
  onAddGuide: (axis: GuideAxis) => void;
  selectedGuideId: string | null;
  onDeleteGuide: (id: string) => void;
  penColor: string;
  onPenColorChange: (color: string) => void;
  penWidth: number;
  onPenWidthChange: (width: number) => void;
  strokeCount: number;
  onUndoStroke: () => void;
  onClearAnnotations: () => void;
  /** ── History: this page's archived Figma exports ───────────────────────── */
  history: HistoryEntry[];
  /** Display name of each viewport, for history entries that only carry its id. */
  viewportLabels: Record<ViewportKey, string>;
  onSaveSnapshot: () => void;
  onLoadSnapshot: (entry: HistoryEntry) => void;
  onDeleteSnapshot: (id: number) => void;
  onRenameSnapshot: (id: number, name: string) => void;
  /** There is an export on the current viewport to archive */
  canSaveSnapshot: boolean;
  /** Why not, when not */
  saveSnapshotHint: string | null;
}

/** Same order as the View menu: the default mode, Split, comes first. */
const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'split', label: 'Split' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'tap', label: 'Tap' },
  { value: 'sideBySide', label: 'Side by side' },
];

const OPACITY_PRESETS = [0, 50, 100];
const NUDGE_STEPS = [-10, -1, 1, 10];
/** The stops the palette prints as buttons — the extremes stay on ±/Fit */
const ZOOM_PRESETS = ZOOM_STEPS.filter((step) => step >= 0.25 && step <= 2);

const BTN = 'ps-btn text-[11px] transition-none';
const FIELD = 'ps-input px-2 text-[11px] placeholder:text-ps-500';
/** A colour well, sized like the buttons beside it rather than like a form. */
const SWATCH =
  'h-6 w-8 shrink-0 cursor-pointer rounded border border-ps-700 bg-transparent p-0';

/**
 * The `?` at the right end of a panel's title bar: opens that panel's section
 * of the docs in a new tab, so the comparison in progress stays as it is.
 *
 * A plain link rather than a script, so it still works when pop-ups from
 * scripts are blocked, and middle-click or "copy link" behave as expected.
 */
function PanelHelpLink({ title }: { title: PanelTitle }) {
  return (
    <a
      href={docsHref(PANEL_DOCS[title])}
      target="_blank"
      rel="noopener"
      aria-label={`Help: ${title} panel`}
      title={`How the ${title} panel works — opens the docs in a new tab`}
      className="mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ps-500 text-[9px] leading-none font-bold text-ps-400 transition-colors hover:border-ps-300 hover:text-ps-200"
    >
      ?
    </a>
  );
}

/**
 * A docked panel, Photoshop style: a title bar you collapse it by, and a body
 * cut off from the one above it by a black seam.
 *
 * The title bar holds two controls side by side — the collapse toggle and the
 * help link — never one inside the other, since a link nested in a button is
 * invalid HTML and its click would also fold the panel.
 */
function Panel({
  title,
  children,
  accent,
  dimmed = false,
}: {
  title: PanelTitle;
  children: ReactNode;
  /** A hairline in the layer's ink, so a panel says which plate it drives */
  accent?: string;
  dimmed?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="shrink-0">
      <div className="ps-titlebar flex items-center">
        <button
          type="button"
          onClick={() => setOpen((on) => !on)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
        >
          <svg
            className={`h-2.5 w-2.5 shrink-0 text-ps-400 ${open ? '' : '-rotate-90'}`}
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2 4l4 5 4-5z" />
          </svg>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ps-200 uppercase">
            {title}
          </span>
          {accent && (
            <span className={`ml-1 h-px w-6 ${accent}`} aria-hidden="true" />
          )}
        </button>
        <PanelHelpLink title={title} />
      </div>
      {open && (
        <div
          className={`flex flex-col gap-3 px-2.5 py-3 ${
            dimmed ? 'pointer-events-none opacity-60' : ''
          }`}
          inert={dimmed}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function Spinner({ className }: { className: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}

/** An arrow rising out of a tray: upload files from disk. */
function UploadIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
    </svg>
  );
}

/**
 * One layer's state: its ink when present, red when the capture failed, a
 * spinner while it is being fetched, grey while there is nothing yet.
 */
function LayerMark({
  state,
  ink,
  title,
}: {
  state: 'pending' | 'busy' | 'done' | 'failed';
  ink: 'cyan' | 'magenta';
  title?: string;
}) {
  if (state === 'busy') {
    return <Spinner className="h-3 w-3 shrink-0 text-press-cyan" />;
  }
  const tone =
    state === 'done'
      ? ink === 'cyan'
        ? 'text-press-cyan'
        : 'text-press-magenta'
      : state === 'failed'
        ? 'text-press-red'
        : 'text-ps-500';
  return (
    <span
      className={`w-3 shrink-0 text-center font-mono text-[11px] leading-none ${tone}`}
      title={title}
    >
      {state === 'done' ? '✓' : state === 'failed' ? '✗' : '–'}
    </span>
  );
}

/** A labelled row: label left, control right, the way a palette lays out. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ps-400">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
    </div>
  );
}

export default function ControlPanel(props: ControlPanelProps) {
  const {
    activeViewport,
    layers,
    onCapture,
    onCaptureLocal,
    onExportAllFigma,
    onCaptureAllSites,
    onExportFigma,
    onUploadFigma,
    onUploadSite,
    onRemoveFigma,
    onRemoveScreenshot,
    opacity,
    onOpacityChange,
    blendMode,
    onBlendModeChange,
    notes,
    onNotesChange,
    notesFor,
    viewMode,
    onViewModeChange,
    syncScroll,
    onSyncScrollChange,
    offsetY,
    onOffsetYChange,
    screenshotHeight,
    figmaHeight,
    zoom,
    onZoomChange,
    onZoomStep,
    onZoomFit,
    canFit,
    isViewing,
    figmaDragEnabled,
    onFigmaDragChange,
    canDragFigma,
    tool,
    onToolChange,
    guides,
    guideColor,
    onGuideColorChange,
    onAddGuide,
    selectedGuideId,
    onDeleteGuide,
    penColor,
    onPenColorChange,
    penWidth,
    onPenWidthChange,
    strokeCount,
    onUndoStroke,
    onClearAnnotations,
    history,
    viewportLabels,
    onSaveSnapshot,
    onLoadSnapshot,
    onDeleteSnapshot,
    onRenameSnapshot,
    canSaveSnapshot,
    saveSnapshotHint,
  } = props;

  const isReady = activeViewport !== null;
  // Sub-pixel drift still rounds to 0px on screen, so the readout agrees
  const aligned = Math.round(offsetY) === 0;
  const zoomPercent = Math.round(zoom * 100);
  // Typing into the zoom field: held as text so the field can be emptied
  const [zoomText, setZoomText] = useState<string | null>(null);

  /**
   * Read a zoom out of whatever was typed. The field carries its own "%", and
   * a percentage is the kind of thing people retype over rather than clear, so
   * the first number in the box wins and the rest is ignored.
   */
  const commitZoom = () => {
    if (zoomText === null) return;
    const parsed = Number(zoomText.match(/\d+(\.\d+)?/)?.[0] ?? NaN);
    setZoomText(null);
    if (Number.isFinite(parsed) && parsed > 0)
      onZoomChange(clampZoom(parsed / 100));
  };

  const nudge = (delta: number) => {
    if (screenshotHeight === null) return;
    onOffsetYChange(
      clampOffset(offsetY + delta, screenshotHeight, figmaHeight),
    );
  };

  const setOffset = (value: number) => {
    if (screenshotHeight === null) return;
    onOffsetYChange(clampOffset(value, screenshotHeight, figmaHeight));
  };

  return (
    <aside className="ps-panel flex w-full shrink-0 flex-col border-b border-ps-950 text-ps-200 lg:w-72 lg:overflow-y-auto lg:border-r lg:border-b-0">
      {/* ── Layers: the selected viewport's two plates — what it holds, how
             to fetch each again, how to drop it ─────────────────────────── */}
      {layers && (
        <Panel title="Layers" accent="bg-press-cyan/50">
          {(() => {
            const { preset, slot, figmaLinked, figmaBusy } = layers;
            const capturing = slot.status === 'capturing';
            const shot = slot.screenshot !== null;
            const siteState = capturing
              ? ('busy' as const)
              : slot.status === 'error'
                ? ('failed' as const)
                : shot
                  ? ('done' as const)
                  : ('pending' as const);
            const blocked = layers.captureBlockedReason;
            return (
              <>
                <div className="flex items-baseline gap-2 text-[11px]">
                  <span className="text-ps-200">{preset.label}</span>
                  <span className="font-mono text-ps-500 tabular-nums">
                    {preset.width}×{preset.height}
                  </span>
                </div>

                {/* The page's Figma frame for this viewport, rendered by
                    Figma itself — the link is set under File ▸ Pages */}
                <Row label="Figma">
                  <LayerMark
                    state={
                      figmaBusy ? 'busy' : slot.figmaSrc ? 'done' : 'pending'
                    }
                    ink="magenta"
                    title={slot.figmaFileName ?? undefined}
                  />
                  <button
                    type="button"
                    onClick={onExportFigma}
                    disabled={!figmaLinked || figmaBusy}
                    title={
                      !figmaLinked
                        ? `No Figma frame link for ${preset.label} — set one under File ▸ Pages`
                        : figmaBusy
                          ? 'Figma is rendering this frame'
                          : `Capture the ${preset.label} Figma frame (⇧M)`
                    }
                    className={`${BTN} flex-1 py-1`}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={onExportAllFigma}
                    disabled={layers.figmaAllBlockedReason !== null}
                    title={
                      layers.figmaAllBlockedReason ??
                      'Capture the Figma frame of every viewport — asks before replacing existing exports'
                    }
                    className={`${BTN} flex-1 py-1`}
                  >
                    All
                  </button>
                  {/* Upload: any number of exports, each landing on the
                      viewport its width matches at 1x or 2x */}
                  <button
                    type="button"
                    onClick={onUploadFigma}
                    title="Upload Figma exports — each goes to the viewport its width matches at 1x or 2x (I)"
                    aria-label="Upload Figma exports"
                    className={`${BTN} px-1.5 py-1 text-press-magenta`}
                  >
                    <UploadIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveFigma}
                    disabled={slot.figmaSrc === null}
                    title={`Remove the ${preset.label} Figma export`}
                    aria-label={`Remove the ${preset.label} Figma export`}
                    className={`${BTN} px-1.5 py-1 text-press-magenta`}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </Row>

                {/* The site at this size: Browserless, or — on localhost —
                    the browser on this machine, which the target sees as this
                    address rather than a datacentre's */}
                <Row label="Site">
                  <LayerMark
                    state={siteState}
                    ink="cyan"
                    title={slot.error ?? undefined}
                  />
                  {/* Hidden while the cloud capture is switched off
                      (lib/features.ts) */}
                  {layers.showCloudCapture && (
                    <button
                      type="button"
                      onClick={onCapture}
                      disabled={blocked !== null}
                      title={
                        blocked ??
                        `Capture ${preset.label} at ${preset.width}×${preset.height} with Browserless (⇧C)`
                      }
                      className={`${BTN} flex-1 py-1`}
                    >
                      Cloud
                    </button>
                  )}
                  {layers.showLocalCapture && (
                    <button
                      type="button"
                      onClick={onCaptureLocal}
                      disabled={blocked !== null}
                      title={
                        blocked ??
                        `Capture ${preset.label} with the browser on this machine (⇧L)`
                      }
                      className={`${BTN} flex-1 py-1`}
                    >
                      Local
                    </button>
                  )}
                  {/* All needs some browser to run in: this machine's, or
                      Browserless when the cloud capture is on */}
                  {(layers.showLocalCapture || layers.showCloudCapture) && (
                    <button
                      type="button"
                      onClick={onCaptureAllSites}
                      disabled={layers.siteAllBlockedReason !== null}
                      title={
                        layers.siteAllBlockedReason ??
                        `Capture the site at every viewport ${
                          layers.showLocalCapture
                            ? 'with the browser on this machine'
                            : 'with Browserless'
                        }`
                      }
                      className={`${BTN} flex-1 py-1`}
                    >
                      All
                    </button>
                  )}
                  {/* Upload: screenshots taken elsewhere, each landing on the
                      viewport its width matches at 1x or 2x */}
                  <button
                    type="button"
                    onClick={onUploadSite}
                    title="Upload site screenshots — each goes to the viewport its width matches at 1x or 2x"
                    aria-label="Upload site screenshots"
                    className={`${BTN} px-1.5 py-1 text-press-cyan`}
                  >
                    <UploadIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveScreenshot}
                    disabled={!shot || capturing}
                    title={`Remove the ${preset.label} site capture`}
                    aria-label={`Remove the ${preset.label} site capture`}
                    className={`${BTN} px-1.5 py-1 text-press-cyan`}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </Row>

                {slot.status === 'error' && slot.error && (
                  <p className="text-[10px] leading-4 break-words text-press-red">
                    {slot.error}
                  </p>
                )}
              </>
            );
          })()}
        </Panel>
      )}

      {/* ── Align: offset, zoom and the drag tool — everything you touch while
             lining two plates up ──────────────────────────────────────────── */}
      <Panel title="Align" accent="bg-press-violet/50" dimmed={!isReady}>
        {/* Vertical alignment — per viewport */}
        <Row label="Offset Y">
          <input
            type="number"
            value={Math.round(offsetY)}
            onChange={(e) => setOffset(Number(e.target.value))}
            aria-label="Figma vertical offset in pixels"
            className={`${FIELD} w-16 py-1 font-mono`}
          />
          {/* The unit, and — at zero, where the layers sit on top of each
              other — the ink that says so */}
          <span
            className={`ml-auto px-1 font-mono text-[11px] ${
              aligned ? 'text-press-violet' : 'text-ps-400'
            }`}
            title={
              aligned
                ? 'The Figma layer sits exactly on the capture'
                : 'The Figma layer is offset from the capture'
            }
          >
            px
          </span>
        </Row>

        <div className="grid grid-cols-4 gap-1">
          {NUDGE_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => nudge(step)}
              title={`Move Figma ${step < 0 ? 'up' : 'down'} ${Math.abs(step)}px`}
              className={`${BTN} py-1 font-mono`}
            >
              {step < 0 ? '↑' : '↓'}
              {Math.abs(step)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setOffset(0)}
            className={`${BTN} py-1`}
          >
            Align top
          </button>
          <button
            type="button"
            onClick={() =>
              screenshotHeight !== null &&
              setOffset(bottomAlignOffset(screenshotHeight, figmaHeight))
            }
            className={`${BTN} py-1`}
          >
            Align bottom
          </button>
        </div>

        <div className="ps-groove my-0.5" />

        {/* ── Zoom ─────────────────────────────────────────────────────────── */}
        <Row label="Zoom">
          <button
            type="button"
            onClick={() => onZoomStep(-1)}
            disabled={!isViewing || zoom <= MIN_ZOOM}
            title="Zoom out (−)"
            className={`${BTN} h-6 w-6 font-mono leading-none`}
          >
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={zoomText ?? `${zoomPercent}%`}
            disabled={!isViewing}
            onChange={(e) => setZoomText(e.target.value)}
            // Select rather than rewrite: touching the state on focus makes the
            // controlled value and the typing race each other
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitZoom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setZoomText(null);
            }}
            aria-label="Zoom level, percent"
            className={`${FIELD} w-14 py-1 text-center font-mono tabular-nums`}
          />
          <button
            type="button"
            onClick={() => onZoomStep(1)}
            disabled={!isViewing || zoom >= MAX_ZOOM}
            title="Zoom in (+)"
            className={`${BTN} h-6 w-6 font-mono leading-none`}
          >
            +
          </button>
        </Row>

        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          step={1}
          value={zoomPercent}
          disabled={!isViewing}
          onChange={(e) =>
            onZoomChange(clampZoom(Number(e.target.value) / 100))
          }
          aria-label="Zoom"
          className="ps-range w-full disabled:opacity-40"
        />

        <div className="grid grid-cols-3 gap-1">
          {ZOOM_PRESETS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => onZoomChange(step)}
              disabled={!isViewing}
              data-on={Math.abs(zoom - step) < 0.001}
              className={`${BTN} py-1 font-mono tabular-nums`}
            >
              {Math.round(step * 100)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onZoomFit}
            disabled={!canFit}
            title="Fit the layer's width to the canvas (F)"
            className={`${BTN} py-1`}
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1)}
            disabled={!isViewing}
            data-on={Math.abs(zoom - 1) < 0.001}
            title="Actual size, 1 screen pixel per capture pixel (0)"
            className={`${BTN} py-1`}
          >
            100% · 1:1
          </button>
        </div>

        <div className="ps-groove my-0.5" />

        {/* ── The drag tool ────────────────────────────────────────────────── */}
        <Row label="Drag">
          <div className="ps-segment flex flex-1 gap-px p-px">
            <button
              type="button"
              onClick={() => onFigmaDragChange(false)}
              data-on={!figmaDragEnabled}
              title="Dragging pans the canvas"
              className={`${BTN} flex flex-1 items-center justify-center gap-1 py-1`}
            >
              <span aria-hidden="true">✥</span> Pan
            </button>
            <button
              type="button"
              onClick={() => onFigmaDragChange(true)}
              disabled={!canDragFigma}
              data-on={figmaDragEnabled}
              title={
                canDragFigma
                  ? 'Dragging moves the Figma layer (V)'
                  : 'Needs a capture and an export on this viewport'
              }
              className={`${BTN} flex flex-1 items-center justify-center gap-1 py-1`}
            >
              <span aria-hidden="true">↕</span> Figma
            </button>
          </div>
        </Row>
        <p className="text-[10px] leading-4 text-ps-500">
          V toggles the tool. ↑/↓ nudge the Figma layer, ⇧ for 10px.
        </p>
      </Panel>

      {/* ── View: how the two layers are composited ──────────────────────── */}
      <Panel title="View">
        <div className="grid grid-cols-2 gap-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onViewModeChange(mode.value)}
              data-on={viewMode === mode.value}
              className={`${BTN} py-1.5`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Opacity and blend mode composite the two layers — overlay only */}
        {viewMode === 'overlay' && (
          <>
            <div className="ps-groove my-0.5" />
            <Row label="Opacity">
              <input
                id="opacity"
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="ps-range min-w-0 flex-1"
              />
              <span className="w-9 shrink-0 text-right font-mono text-[11px] text-ps-300 tabular-nums">
                {opacity}%
              </span>
            </Row>
            <div className="grid grid-cols-3 gap-1">
              {OPACITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onOpacityChange(preset)}
                  data-on={opacity === preset}
                  className={`${BTN} py-1 font-mono tabular-nums`}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <Row label="Blend">
              <select
                id="blend-mode"
                value={blendMode}
                onChange={(e) => onBlendModeChange(e.target.value as BlendMode)}
                className={`${FIELD} min-w-0 flex-1 py-1`}
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </Row>
          </>
        )}

        {viewMode === 'sideBySide' && (
          <label className="flex items-center gap-2 text-[11px] text-ps-300">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => onSyncScrollChange(e.target.checked)}
              className="accent-press-violet"
            />
            Sync scroll
            <span className="ml-auto text-[10px] text-ps-500">
              offset shifts the lock
            </span>
          </label>
        )}
      </Panel>

      {/* ── Tools: what you draw over the pair, in whatever ink you pick ─── */}
      <Panel title="Tools" accent="bg-press-amber/50">
        <Row label="Guides">
          <button
            type="button"
            onClick={() => onAddGuide('x')}
            title="Drop a vertical guide across the canvas (G)"
            className={`${BTN} flex-1 py-1`}
          >
            + Vertical
          </button>
          <button
            type="button"
            onClick={() => onAddGuide('y')}
            title="Drop a horizontal guide across the canvas (⇧G)"
            className={`${BTN} flex-1 py-1`}
          >
            + Horizontal
          </button>
        </Row>

        <Row label="Colour">
          <input
            type="color"
            value={guideColor}
            onChange={(e) => onGuideColorChange(e.target.value)}
            aria-label="Guide colour"
            title={
              selectedGuideId
                ? 'Recolours the selected guide'
                : 'The colour new guides are dropped in'
            }
            className={SWATCH}
          />
          <span className="text-[10px] text-ps-500">
            {guides.length === 0
              ? 'none yet'
              : `${guides.length} guide${guides.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={() => selectedGuideId && onDeleteGuide(selectedGuideId)}
            disabled={selectedGuideId === null}
            title="Remove the selected guide — or double-click its handle"
            className={`${BTN} ml-auto py-1`}
          >
            Remove
          </button>
        </Row>

        <div className="ps-groove my-0.5" />

        <Row label="Pen">
          <div className="ps-segment flex flex-1 gap-px p-px">
            <button
              type="button"
              onClick={() => onToolChange('none')}
              data-on={tool === 'none'}
              title="Pointer — pan, split and drag work as usual"
              className={`${BTN} flex flex-1 items-center justify-center gap-1 py-1`}
            >
              <span aria-hidden="true">✥</span> Off
            </button>
            <button
              type="button"
              onClick={() => onToolChange('pen')}
              data-on={tool === 'pen'}
              title="Draw over both layers (D)"
              className={`${BTN} flex flex-1 items-center justify-center gap-1 py-1`}
            >
              <span aria-hidden="true">✎</span> Draw
            </button>
          </div>
        </Row>

        <Row label="Colour">
          <input
            type="color"
            value={penColor}
            onChange={(e) => onPenColorChange(e.target.value)}
            aria-label="Pen colour"
            className={SWATCH}
          />
          <div className="ml-1 grid flex-1 grid-cols-4 gap-1">
            {PEN_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => onPenWidthChange(width)}
                data-on={penWidth === width}
                title={`${width}px nib`}
                className={`${BTN} py-1 font-mono tabular-nums`}
              >
                {width}
              </button>
            ))}
          </div>
        </Row>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onUndoStroke}
            disabled={strokeCount === 0}
            title="Undo the last stroke (Z)"
            className={`${BTN} py-1`}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onClearAnnotations}
            disabled={strokeCount === 0 && guides.length === 0}
            title="Remove every guide and stroke"
            className={`${BTN} py-1`}
          >
            Clear all
          </button>
        </div>

        <p className="text-[10px] leading-4 text-ps-500">
          G and ⇧G drop guides, D picks up the pen, Z undoes a stroke. Guides
          and drawings sit over both layers and are not saved with the page.
        </p>
      </Panel>

      {/* ── History: the Figma exports this page has kept ─────────────────── */}
      <Panel title="History" accent="bg-press-magenta/50">
        <SnapshotHistory
          entries={history}
          viewportLabels={viewportLabels}
          onLoad={onLoadSnapshot}
          onDelete={onDeleteSnapshot}
          onRename={onRenameSnapshot}
          onSave={onSaveSnapshot}
          canSave={canSaveSnapshot}
          saveHint={saveSnapshotHint}
        />
      </Panel>

      {/* ── Notes: free-form, and kept per page ──────────────────────────── */}
      <Panel title="Notes">
        <span className="truncate text-[10px] text-ps-500" title={notesFor}>
          {notesFor}
        </span>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={6}
          placeholder="What's off, what to check, what you told the designer…"
          className={`${FIELD} resize-y py-1.5 leading-5`}
        />
      </Panel>

      {/* ── Footer: the app version, pinned to the bottom of the dock ─────── */}
      <footer className="mt-auto shrink-0 border-t border-ps-950 px-2.5 py-1.5 font-mono text-[10px] text-ps-500 tabular-nums">
        v{APP_VERSION}
      </footer>
    </aside>
  );
}
