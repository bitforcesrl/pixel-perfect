'use client';

import { useRef, useState } from 'react';
import { useDraft } from './useDraft';
import {
  annotationId,
  clampGuide,
  strokePath,
  type Guide,
  type Stroke,
} from '@/lib/annotations';

export type Tool = 'none' | 'pen';

export interface AnnotationLayerProps {
  tool: Tool;
  guides: Guide[];
  strokes: Stroke[];
  penColor: string;
  penWidth: number;
  selectedGuideId: string | null;
  onMoveGuide: (id: string, pos: number) => void;
  onDeleteGuide: (id: string) => void;
  onSelectGuide: (id: string | null) => void;
  onAddStroke: (stroke: Stroke) => void;
}

/** Below this the pointer has not really moved — skip the point. */
const MIN_STEP = 2;

const HANDLE =
  'pointer-events-auto flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-950 shadow-md select-none';

/**
 * Guides and freehand marks, over both plates at once.
 *
 * It fills its parent, which is the canvas's content wrapper — so in overlay,
 * split and tap it scrolls with the layers and a mark stays on the element it
 * was drawn over, while in side by side, where the panes scroll inside a canvas
 * that does not, a guide spans both panes and reads across the seam. That is
 * the whole reason this lives beside the viewers rather than inside one.
 *
 * Positions are canvas px, not image px: zooming repaints the layers underneath
 * and leaves the guides where they are. One coordinate system, valid in every
 * view mode.
 */
export default function AnnotationLayer({
  tool,
  guides,
  strokes,
  penColor,
  penWidth,
  selectedGuideId,
  onMoveGuide,
  onDeleteGuide,
  onSelectGuide,
  onAddStroke,
}: AnnotationLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // The stroke being drawn. Held in state so it paints as it goes, and mirrored
  // in a ref because pointermove fires faster than React commits.
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const draggingRef = useRef<string | null>(null);
  // The guide being dragged and where it is, held here until release so the
  // workspace is not re-rendered for every pixel of the drag
  const guideDraft = useDraft<{ id: string; pos: number } | null>(null);
  const posOf = (guide: Guide) =>
    guideDraft.value?.id === guide.id ? guideDraft.value.pos : guide.pos;

  const localPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** ── The pen ─────────────────────────────────────────────────────────── */

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pen' || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = localPoint(e);
    const stroke: Stroke = {
      id: annotationId('stroke'),
      color: penColor,
      width: penWidth,
      points: [x, y],
    };
    drawingRef.current = stroke;
    setDrawing(stroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stroke = drawingRef.current;
    if (!stroke) return;
    const { x, y } = localPoint(e);
    const lastX = stroke.points[stroke.points.length - 2];
    const lastY = stroke.points[stroke.points.length - 1];
    if (Math.abs(x - lastX) < MIN_STEP && Math.abs(y - lastY) < MIN_STEP)
      return;
    const next = { ...stroke, points: [...stroke.points, x, y] };
    drawingRef.current = next;
    setDrawing(next);
  };

  const endStroke = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    setDrawing(null);
    if (stroke) onAddStroke(stroke);
  };

  /** ── The guides ──────────────────────────────────────────────────────── */

  const startGuideDrag = (e: React.PointerEvent<HTMLElement>, guide: Guide) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = guide.id;
    onSelectGuide(guide.id);
  };

  const dragGuide = (e: React.PointerEvent<HTMLElement>, guide: Guide) => {
    if (draggingRef.current !== guide.id) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos =
      guide.axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top;
    guideDraft.set({
      id: guide.id,
      pos: clampGuide(pos, guide.axis === 'x' ? rect.width : rect.height),
    });
  };

  const endGuideDrag = () => {
    draggingRef.current = null;
    const moved = guideDraft.take()?.value;
    if (moved) onMoveGuide(moved.id, moved.pos);
  };

  const painted = drawing ? [...strokes, drawing] : strokes;

  return (
    <div
      ref={rootRef}
      // Out of the way until the pen is up: pan, the split divider and the
      // Figma drag all live underneath and must keep receiving pointers
      className={`absolute inset-0 z-10 ${
        tool === 'pen' ? 'cursor-crosshair touch-none' : 'pointer-events-none'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
    >
      {/* The marks. Vector rather than a bitmap: a full-page capture can run to
          tens of thousands of pixels, well past what a canvas element holds. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {painted.map((stroke) => (
          <path
            key={stroke.id}
            d={strokePath(stroke)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {guides.map((guide) => {
        const selected = guide.id === selectedGuideId;
        const vertical = guide.axis === 'x';
        return (
          <div
            key={guide.id}
            className={`absolute ${vertical ? 'inset-y-0' : 'inset-x-0'}`}
            style={vertical ? { left: posOf(guide) } : { top: posOf(guide) }}
          >
            <div
              className={`absolute ${
                vertical
                  ? 'inset-y-0 -left-px w-0.5'
                  : 'inset-x-0 -top-px h-0.5'
              }`}
              style={{ backgroundColor: guide.color }}
            />
            {/* Sticky so the handle stays reachable however far the canvas has
                been scrolled — the same trick the viewer's chips use */}
            <div
              className={
                vertical
                  ? 'sticky top-2 w-fit -translate-x-1/2'
                  : 'sticky left-2 w-fit -translate-y-1/2'
              }
            >
              {/* A button rather than a slider: a slider would advertise a
                  range this has no end of, and read out a clamped percentage */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${vertical ? 'Vertical' : 'Horizontal'} guide at ${Math.round(
                  posOf(guide),
                )}px — arrow keys move it, Delete removes it`}
                onPointerDown={(e) => startGuideDrag(e, guide)}
                onPointerMove={(e) => dragGuide(e, guide)}
                onPointerUp={endGuideDrag}
                onPointerCancel={endGuideDrag}
                onDoubleClick={() => onDeleteGuide(guide.id)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 1;
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    onMoveGuide(guide.id, guide.pos - step);
                  }
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    onMoveGuide(guide.id, guide.pos + step);
                  }
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    onDeleteGuide(guide.id);
                  }
                }}
                title="Drag to move · double-click to remove"
                className={`${HANDLE} ${
                  vertical ? 'cursor-ew-resize' : 'cursor-ns-resize'
                } ${selected ? 'ring-2 ring-ink-100' : ''}`}
                style={{ backgroundColor: guide.color }}
              >
                <span aria-hidden="true">{vertical ? '↔' : '↕'}</span>
                {Math.round(posOf(guide))}
                <button
                  type="button"
                  aria-label="Remove guide"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onDeleteGuide(guide.id)}
                  className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
