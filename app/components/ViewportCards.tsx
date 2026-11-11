"use client";

import { useState } from "react";
import { type ViewportKey, type ViewportPreset } from "@/lib/viewports";
import { dropSide, hasFiles, imageFiles, type DropSide } from "@/lib/drop";

export interface ViewportCardsProps {
  presets: ViewportPreset[];
  active: ViewportKey | null;
  onSelect: (key: ViewportKey) => void;
  /** An export dropped on a card belongs to that card, whatever it measures. */
  onDropFigma: (key: ViewportKey, file: File) => void;
  /** A screenshot dropped on a card's right half is that card's site layer. */
  onDropSite: (key: ViewportKey, file: File) => void;
  /** Something that is not an image was dropped — say so rather than ignore it. */
  onDropRejected: (transfer: DataTransfer) => void;
}

/** The card a file is hovering over, and which half of it. */
interface DropTarget {
  key: ViewportKey;
  side: DropSide;
}

/** Each half's ink while a file hovers it — the same inks the canvas uses. */
const HALF_INK: Record<DropSide, string> = {
  figma: "border-press-magenta bg-press-magenta/15 text-press-magenta",
  site: "border-press-cyan bg-press-cyan/15 text-press-cyan",
};

/**
 * The viewports, one tab each, named by the size they shoot at.
 *
 * The tab only picks the viewport: what it holds, and the buttons that fetch
 * or drop its layers, live in the inspector's Layers panel. A tab is also a
 * drop target for its own viewport, split like the canvas: left half takes
 * the Figma export, right half the site screenshot.
 */
export default function ViewportCards({
  presets,
  active,
  onSelect,
  onDropFigma,
  onDropSite,
  onDropRejected,
}: ViewportCardsProps) {
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  return (
    // Narrow screens scroll the strip rather than clipping the last viewport
    <div
      role="tablist"
      aria-label="Viewport"
      className="flex max-w-full items-stretch gap-1.5 overflow-x-auto border-b border-ink-800 bg-ink-950 px-2 py-1.5"
    >
      {presets.map((preset) => {
        const isActive = active === preset.key;
        const hovered = dropTarget?.key === preset.key ? dropTarget.side : null;
        return (
          <button
            key={preset.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(preset.key)}
            // Drop a 1440 export on the mobile card and it becomes the mobile
            // layer: where it was aimed wins over what it measures
            onDragOver={(e) => {
              if (!hasFiles(e.dataTransfer)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              const side = dropSide(e.currentTarget, e.clientX);
              if (hovered !== side) setDropTarget({ key: preset.key, side });
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setDropTarget((current) =>
                current?.key === preset.key ? null : current,
              );
            }}
            onDrop={(e) => {
              if (!hasFiles(e.dataTransfer)) return;
              e.preventDefault();
              setDropTarget(null);
              // From the pointer, not the hover state: it may not have rendered
              const side = dropSide(e.currentTarget, e.clientX);
              const [file] = imageFiles(e.dataTransfer);
              if (!file) {
                onDropRejected(e.dataTransfer);
                return;
              }
              if (side === "site") onDropSite(preset.key, file);
              else onDropFigma(preset.key, file);
            }}
            title={
              hovered === "figma"
                ? `Drop as the ${preset.label} Figma export`
                : hovered === "site"
                  ? `Drop as the ${preset.label} site screenshot`
                  : preset.label
            }
            className={`relative shrink-0 overflow-hidden rounded border px-3 py-1 font-mono text-[11px] whitespace-nowrap tabular-nums transition-colors ${
              hovered
                ? HALF_INK[hovered]
                : isActive
                  ? "border-press-violet bg-ink-900 text-press-violet"
                  : "border-ink-800 bg-ink-900/40 text-ink-400 hover:border-ink-700 hover:text-ink-300"
            }`}
          >
            {/* While a file hovers, the half it would land on lights up */}
            {hovered && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 w-1/2 ${
                  hovered === "figma"
                    ? "left-0 bg-press-magenta/20"
                    : "right-0 bg-press-cyan/20"
                }`}
              />
            )}
            {/* The label stays put: a label that changed width under the
                pointer would move the halves it is choosing between */}
            <span className="relative">
              {preset.width}×{preset.height}
            </span>
          </button>
        );
      })}
    </div>
  );
}
