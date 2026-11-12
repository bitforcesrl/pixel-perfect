'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * A value edited locally while a gesture is in progress, committed once at the
 * end.
 *
 * Dragging the Figma layer or a guide moves something many times a second.
 * Sent up on every pointer move, each step re-rendered the whole workspace
 * (menus, panels, both viewers); held here, only the component being dragged
 * re-renders, and its parent hears about the result once, on release.
 *
 * `value` is the draft while there is one and `committed` otherwise. `take`
 * ends the gesture and returns the draft (null when nothing moved), for the
 * caller to commit.
 */
export function useDraft<T>(committed: T) {
  // Boxed, so a draft of `null` or `0` still counts as one
  const [draft, setDraftState] = useState<{ value: T } | null>(null);
  // Pointer events can outrun React's commits: the latest draft lives here too
  const draftRef = useRef<{ value: T } | null>(null);

  const set = useCallback((value: T) => {
    const next = { value };
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const take = useCallback((): { value: T } | null => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraftState(null);
    return current;
  }, []);

  return {
    value: draft ? draft.value : committed,
    active: draft !== null,
    set,
    take,
  };
}
