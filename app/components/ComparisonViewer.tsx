'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampOffset } from '@/lib/offset';
import TiledImage from './TiledImage';
import type { BlendMode, ViewMode } from '@/lib/types';

export interface ComparisonViewerProps {
  screenshotSrc: string | null; // data URL from API (null = not captured yet)
  figmaSrc: string | null; // object URL of uploaded Figma export (null = not yet uploaded)
  screenshotWidth: number | null; // px, from API — the unscaled image size
  screenshotHeight: number | null;
  opacity: number; // 0-100, applied to Figma layer
  blendMode: BlendMode; // applied to Figma layer
  viewMode: ViewMode;
  offsetY: number; // image px, vertical offset of the Figma layer (positive = down)
  zoom: number; // 1 = 100%
  figmaDragEnabled: boolean; // true: drag moves Figma, false: drag pans the canvas
  scrollRef: React.RefObject<HTMLElement | null>; // the surface panning scrolls
  onOffsetYChange: (offsetY: number) => void;
  onFigmaHeightChange: (height: number | null) => void; // rendered height, for the panel's align controls
}

/** Where a pointer drag started, and what it is allowed to move. */
type Drag =
  | { kind: 'split' }
  | { kind: 'figma'; y: number; offset: number }
  | {
      kind: 'pan';
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
    };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Layer chips carry their plate's ink so a glance names what you are seeing. */
const CHIP = 'rounded border px-2 py-1 text-xs font-medium bg-ink-void';
const CHIP_SITE = `${CHIP} border-press-cyan/40 text-press-cyan`;
const CHIP_FIGMA = `${CHIP} border-press-magenta/40 text-press-magenta`;

export default function ComparisonViewer(props: ComparisonViewerProps) {
  const {
    screenshotSrc,
    figmaSrc,
    screenshotWidth,
    screenshotHeight,
    opacity,
    blendMode,
    viewMode,
    offsetY,
    zoom,
    figmaDragEnabled,
    scrollRef,
    onOffsetYChange,
    onFigmaHeightChange,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPos, setSplitPos] = useState(50); // 0-100, % from left
  const [isDragging, setIsDragging] = useState(false);
  const [isPressing, setIsPressing] = useState(false); // tap mode: press-and-hold

  // Measured Figma size, tagged with the src it came from so a new upload
  // invalidates it without an effect
  const [measured, setMeasured] = useState<{
    src: string;
    ratio: number;
    width: number;
  } | null>(null);
  const dragRef = useRef<Drag | null>(null);

  // Space suspends the divider so split can pan like every other mode
  const [spaceHeld, setSpaceHeld] = useState(false);
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const tag = (target as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return;
      e.preventDefault(); // Space would otherwise scroll the canvas
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    // A blurred window never delivers keyup, and a stuck flag is worse than a
    // dropped one
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Zoom only affects what is painted — every offset stays in image px
  const displayWidth = screenshotWidth === null ? null : screenshotWidth * zoom;
  const displayHeight =
    screenshotHeight === null ? null : screenshotHeight * zoom;

  // Unscaled height of the Figma layer once fitted to the screenshot width
  const figmaHeight =
    measured && measured.src === figmaSrc && screenshotWidth !== null
      ? screenshotWidth * measured.ratio
      : null;

  const handleFigmaSize = (naturalWidth: number, naturalHeight: number) => {
    if (!figmaSrc || !naturalWidth) return;
    const ratio = naturalHeight / naturalWidth;
    setMeasured({ src: figmaSrc, ratio, width: naturalWidth });
    // Without a capture there is nothing to fit the layer to, so the panel's
    // align controls stay out of it
    onFigmaHeightChange(
      screenshotWidth === null ? null : screenshotWidth * ratio,
    );
  };

  const updateSplitFromPointer = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSplitPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }, []);

  // Split owns the drag unless Space suspends it or the toolbar hands drags to
  // the Figma layer; then this behaves exactly like overlay and tap
  const splitting = viewMode === 'split' && !spaceHeld && !figmaDragEnabled;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode === 'tap') setIsPressing(true);

    // Alt works at press time; Space is tracked because it must also change the
    // cursor before anything is pressed
    if (splitting && !e.altKey) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { kind: 'split' };
      setIsDragging(true);
      updateSplitFromPointer(e.clientX);
      return;
    }

    if (figmaDragEnabled) {
      dragRef.current = { kind: 'figma', y: e.clientY, offset: offsetY };
    } else {
      const surface = scrollRef.current;
      if (!surface) return;
      dragRef.current = {
        kind: 'pan',
        x: e.clientX,
        y: e.clientY,
        scrollLeft: surface.scrollLeft,
        scrollTop: surface.scrollTop,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'split') {
      updateSplitFromPointer(e.clientX);
      return;
    }

    if (drag.kind === 'pan') {
      const surface = scrollRef.current;
      if (!surface) return;
      surface.scrollLeft = drag.scrollLeft - (e.clientX - drag.x);
      surface.scrollTop = drag.scrollTop - (e.clientY - drag.y);
      return;
    }

    // Pointer travel is on screen, the offset is in image px
    onOffsetYChange(
      clampOffset(
        drag.offset + (e.clientY - drag.y) / zoom,
        screenshotHeight ?? 0,
        figmaHeight,
      ),
    );
  };

  const endDrag = () => {
    setIsDragging(false);
    setIsPressing(false);
    dragRef.current = null;
  };

  // Sub-pixel drift still rounds to 0px on screen, so the readout agrees
  const aligned = Math.round(offsetY) === 0;

  const cursor = splitting
    ? 'cursor-ew-resize'
    : figmaDragEnabled
      ? 'cursor-ns-resize'
      : isDragging
        ? 'cursor-grabbing'
        : 'cursor-grab';

  // Nothing captured yet — show the Figma export on its own. Its own pixels are
  // the only size reference here, so zoom rides the natural width.
  if (
    screenshotSrc === null ||
    displayWidth === null ||
    displayHeight === null
  ) {
    if (!figmaSrc) return null;
    const figmaWidth =
      measured && measured.src === figmaSrc ? measured.width * zoom : undefined;
    return (
      // The width rides the wrapper: `max-width: 100%` on images would let a
      // narrow canvas shrink the layer and silently undo the zoom
      <div className="relative inline-block" style={{ width: figmaWidth }}>
        <TiledImage
          src={figmaSrc}
          alt="Figma design"
          onSize={handleFigmaSize}
          className="block w-full"
        />
        {/* Sticky so the label survives scrolling a tall export */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="sticky top-3 px-3">
            <span className={`inline-block ${CHIP_FIGMA}`}>
              Figma — capture the site to compare
            </span>
          </div>
        </div>
      </div>
    );
  }

  // No Figma uploaded yet — show screenshot only with a hint
  if (!figmaSrc) {
    return (
      <div className="relative inline-block" style={{ width: displayWidth }}>
        <TiledImage
          src={screenshotSrc}
          alt="Website screenshot"
          className="block w-full"
        />
        {/* Sticky so the label survives scrolling a full-page capture */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="sticky top-3 px-3">
            <span className={`inline-block ${CHIP_SITE}`}>
              Site — upload Figma export to compare
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative isolate touch-none overflow-hidden select-none ${cursor}`}
        style={{ width: displayWidth, height: displayHeight }}
      >
        {viewMode === 'tap' ? (
          <>
            {/* Tap mode: site screenshot always visible, Figma only while pressing */}
            <TiledImage
              src={screenshotSrc}
              alt="Website screenshot"
              className="block w-full"
            />
            {/* Figma overlay — visible only while pressing */}
            {isPressing && (
              <div
                className="absolute inset-x-0"
                style={{ top: offsetY * zoom }}
              >
                <TiledImage
                  src={figmaSrc}
                  alt="Figma design"
                  onSize={handleFigmaSize}
                  className="block w-full"
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Base layer: website screenshot */}
            <TiledImage
              src={screenshotSrc}
              alt="Website screenshot"
              className="block w-full"
            />
            {/* Figma layer: scaled to screenshot width, offset vertically.
                Offset rides `top`, never `transform` — a transform would open a
                stacking context and isolate the Figma layer from the blend. */}
            <div
              className="pointer-events-none absolute inset-x-0"
              style={{
                top: offsetY * zoom,
                ...(viewMode === 'split'
                  ? { clipPath: `inset(0 ${100 - splitPos}% 0 0)` }
                  : {}),
              }}
            >
              {/* The blend rides the strip column: the strips never overlap,
                  so blending the column is blending each of them */}
              <TiledImage
                src={figmaSrc}
                alt="Figma design"
                onSize={handleFigmaSize}
                className="block w-full"
                style={
                  viewMode === 'overlay'
                    ? { mixBlendMode: blendMode, opacity: opacity / 100 }
                    : undefined
                }
              />
            </div>
          </>
        )}
      </div>

      {/* Tap label — outside the clipping container so it can stick */}
      {viewMode === 'tap' && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="sticky top-3 px-3">
            <span
              className={`inline-block ${isPressing ? CHIP_FIGMA : CHIP_SITE}`}
            >
              {isPressing ? 'Figma' : 'Site'} —{' '}
              {isPressing ? 'release to hide' : 'hold to see Figma'}
            </span>
          </div>
        </div>
      )}

      {/* Offset readout — the align controls themselves live in the panel.
          At zero the two layers sit on top of each other, and it lights up. */}
      <div
        className={`pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border bg-ink-void px-2 py-1 transition-colors ${
          aligned
            ? 'border-press-violet/60 text-press-violet'
            : 'border-ink-700 text-ink-200'
        }`}
      >
        <span className="font-mono text-[11px] tabular-nums">
          offset {offsetY > 0 ? '+' : ''}
          {Math.round(offsetY)}px
        </span>
        <span className="border-l border-ink-700 pl-2 text-[11px] text-ink-500">
          {splitting
            ? 'hold Space to pan'
            : figmaDragEnabled
              ? 'drag ↕ to align'
              : 'drag to pan'}
        </span>
      </div>

      {/* Split divider */}
      {viewMode === 'split' && (
        <div
          className="pointer-events-none absolute inset-y-0 z-10"
          style={{ left: `${splitPos}%` }}
        >
          {/* The seam where the two inks meet takes the colour they make */}
          <div className="absolute inset-y-0 -left-px w-0.5 bg-press-violet" />
          <div className="absolute top-1/2 -left-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-press-violet bg-ink-950 text-press-violet shadow-lg">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
            </svg>
          </div>
          {/* Side labels ride the scroll, pinned to either side of the divider */}
          <div className="sticky top-3">
            <span className="absolute -left-16 rounded border border-press-magenta/40 bg-ink-void px-2 py-0.5 text-[11px] font-medium text-press-magenta">
              Figma
            </span>
            <span className="absolute left-2 rounded border border-press-cyan/40 bg-ink-void px-2 py-0.5 text-[11px] font-medium text-press-cyan">
              Site
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
