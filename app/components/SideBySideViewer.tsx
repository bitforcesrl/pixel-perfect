"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { clampOffset } from "@/lib/offset";
import type { ScrollPos } from "@/lib/scrollsync";
import TiledImage from "./TiledImage";

export interface SideBySideViewerProps {
  screenshotSrc: string;
  figmaSrc: string;
  screenshotWidth: number; // px, unscaled — both panes render at this width
  screenshotHeight: number; // px, unscaled
  figmaHeight: number | null; // px, unscaled, fitted to the screenshot width
  zoom: number; // 1 = 100%
  offsetY: number; // image px, positive pushes the Figma layer down
  syncScroll: boolean;
  figmaDragEnabled: boolean; // true: dragging the Figma pane moves the layer
  scrollPosRef: React.RefObject<ScrollPos>; // shared with the other view modes
  onOffsetYChange: (offsetY: number) => void;
  onFigmaHeightChange: (height: number | null) => void;
}

/** Where a pointer drag started, and what it is allowed to move. */
type Drag =
  | { kind: "figma"; y: number; offset: number }
  | {
      kind: "pan";
      pane: HTMLDivElement;
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
    };

const PANE = "min-w-0 flex-1 overflow-auto select-none";
const CHIP =
  "pointer-events-none absolute top-2 left-2 z-10 rounded border bg-ink-void px-2 py-1 text-xs font-medium";
const CHIP_SITE = `${CHIP} border-press-cyan/40 text-press-cyan`;
const CHIP_FIGMA = `${CHIP} border-press-magenta/40 text-press-magenta`;

export default function SideBySideViewer(props: SideBySideViewerProps) {
  const {
    screenshotSrc,
    figmaSrc,
    screenshotWidth,
    screenshotHeight,
    figmaHeight,
    zoom,
    offsetY,
    syncScroll,
    figmaDragEnabled,
    scrollPosRef,
    onOffsetYChange,
    onFigmaHeightChange,
  } = props;

  const siteRef = useRef<HTMLDivElement>(null);
  const figmaRef = useRef<HTMLDivElement>(null);
  // Set while writing a partner's scroll position, so the scroll event that
  // write fires does not bounce straight back
  const syncingRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<Drag["kind"] | null>(null);

  const width = screenshotWidth * zoom;

  // The offset rides the Figma image's top margin, as it rides `top` in the
  // overlay: the pane then lines up with the site at the same scroll position,
  // so the offset shows (and drags) even with both panes parked at the top.
  // A negative margin clips the export's top, as the overlay's frame does.
  const mirror = (from: HTMLDivElement, to: HTMLDivElement) => {
    syncingRef.current = true;
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  // Opens on the spot the previous view mode was showing, and holds it across
  // zooms. Before paint, so no frame shows the panes parked at the top.
  useLayoutEffect(() => {
    const site = siteRef.current;
    const figma = figmaRef.current;
    if (!site || !figma) return;
    const { top, left } = scrollPosRef.current;
    site.scrollTop = top * zoom;
    site.scrollLeft = left * zoom;
    mirror(site, figma);
  }, [scrollPosRef, zoom, syncScroll]);

  // The Figma export has no known height until it decodes, so the pane
  // clamped it at the top — line it up again now there is room to scroll
  const handleFigmaSize = (naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth) onFigmaHeightChange(screenshotWidth * (naturalHeight / naturalWidth));
    const site = siteRef.current;
    const figma = figmaRef.current;
    if (site && figma) mirror(site, figma);
  };

  const handleSiteScroll = () => {
    const site = siteRef.current;
    const figma = figmaRef.current;
    if (!site || !figma) return;
    // The site pane speaks for the view: it is what the other modes show
    scrollPosRef.current = {
      top: site.scrollTop / zoom,
      left: site.scrollLeft / zoom,
    };
    if (!syncScroll || syncingRef.current) return;
    mirror(site, figma);
  };

  const handleFigmaScroll = () => {
    if (!syncScroll || syncingRef.current) return;
    const site = siteRef.current;
    const figma = figmaRef.current;
    if (!site || !figma) return;
    mirror(figma, site);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // A press on the pane itself is a press on its scrollbar: leave it be
    if (e.button !== 0 || e.target === e.currentTarget) return;
    const pane = e.currentTarget;
    if (figmaDragEnabled && pane === figmaRef.current) {
      dragRef.current = { kind: "figma", y: e.clientY, offset: offsetY };
    } else {
      dragRef.current = {
        kind: "pan",
        pane,
        x: e.clientX,
        y: e.clientY,
        scrollLeft: pane.scrollLeft,
        scrollTop: pane.scrollTop,
      };
    }
    pane.setPointerCapture(e.pointerId);
    setDragging(dragRef.current.kind);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    // The pane's own scroll handler carries the pan over to its partner
    if (drag.kind === "pan") {
      drag.pane.scrollLeft = drag.scrollLeft - (e.clientX - drag.x);
      drag.pane.scrollTop = drag.scrollTop - (e.clientY - drag.y);
      return;
    }

    // Pointer travel is on screen, the offset is in image px
    onOffsetYChange(
      clampOffset(
        drag.offset + (e.clientY - drag.y) / zoom,
        screenshotHeight,
        figmaHeight,
      ),
    );
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };

  const panCursor = dragging === "pan" ? "cursor-grabbing" : "cursor-grab";
  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  // Each pane is exactly as wide as the image it holds, so the two meet at the
  // divider and the pair sits centred. Past half the canvas they shrink to fit
  // and scroll internally, still flush against the divider.
  const paneStyle = { flex: "0 1 auto", width } as const;

  return (
    <div className="flex h-full w-full justify-center">
      {/* The chips sit outside the scroll ports: inside, they would take up
          layout space above the image and throw the sync maths off */}
      <div className="relative flex min-w-0" style={paneStyle}>
        <div
          ref={figmaRef}
          onScroll={handleFigmaScroll}
          {...dragHandlers}
          className={`${PANE} ${figmaDragEnabled ? "cursor-ns-resize" : panCursor}`}
        >
          <TiledImage
            src={figmaSrc}
            alt="Figma design"
            onSize={handleFigmaSize}
            className="block"
            style={{ width, marginTop: offsetY * zoom }}
          />
        </div>
        <span className={CHIP_FIGMA}>Figma</span>
      </div>

      {/* The seam between the plates, in the colour their inks make */}
      <div className="w-px shrink-0 bg-press-violet/50" />

      <div className="relative flex min-w-0" style={paneStyle}>
        <div
          ref={siteRef}
          onScroll={handleSiteScroll}
          {...dragHandlers}
          className={`${PANE} ${panCursor}`}
        >
          <TiledImage
            src={screenshotSrc}
            alt="Website screenshot"
            className="block"
            // Sized up front so the pane can scroll before the image decodes
            style={{ width, height: screenshotHeight * zoom }}
          />
        </div>
        <span className={CHIP_SITE}>Site</span>
      </div>
    </div>
  );
}
