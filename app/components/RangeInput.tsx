'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface RangeInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /**
   * Every step of a pointer drag. Optional: without it, the drag only shows
   * on the thumb and the readout until it is let go.
   */
  onLive?: (value: number) => void;
  /** The value settled on: the end of a drag, or a keyboard step. */
  onCommit: (value: number) => void;
  /** Rendered after the input with the value being shown, e.g. "42%". */
  readout?: (value: number) => ReactNode;
}

/**
 * A range slider that keeps its in-flight value to itself.
 *
 * A controlled `<input type="range">` sends every pixel of a drag to its
 * owner, which here is the 3000-line workspace. This one moves its own thumb
 * and readout, reports each step through `onLive` for whoever needs to show it
 * (cheaply), and commits to the owner once, when the pointer is released.
 * Keyboard steps commit straight away: they are single, deliberate changes.
 */
export default function RangeInput({
  value,
  min,
  max,
  step = 1,
  id,
  disabled,
  className,
  'aria-label': ariaLabel,
  onLive,
  onCommit,
  readout,
}: RangeInputProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  // Listeners for the end of a drag, which can happen anywhere on the page
  const releaseRef = useRef<AbortController | null>(null);

  // Unmounted mid-drag (the panel closed): drop the listeners
  useEffect(() => () => releaseRef.current?.abort(), []);

  const finish = () => {
    releaseRef.current?.abort();
    releaseRef.current = null;
    const settled = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (settled !== null) onCommit(settled);
  };

  const shown = draft ?? value;

  return (
    <>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label={ariaLabel}
        className={className}
        onPointerDown={() => {
          releaseRef.current?.abort();
          const release = new AbortController();
          releaseRef.current = release;
          // The pointer is often let go outside the slider itself
          window.addEventListener('pointerup', finish, {
            signal: release.signal,
          });
          window.addEventListener('pointercancel', finish, {
            signal: release.signal,
          });
        }}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (releaseRef.current) {
            draftRef.current = next;
            setDraft(next);
            onLive?.(next);
          } else {
            onCommit(next);
          }
        }}
      />
      {readout?.(shown)}
    </>
  );
}
