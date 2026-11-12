/**
 * A value that changes many times a second while something is being dragged,
 * shared between the control that drives it and the view that shows it —
 * without going through the state of the component that owns both.
 *
 * The owner keeps the committed value in state as usual; while a drag is in
 * progress the control writes here and only the subscribers re-render. When
 * the drag ends the control commits once and clears this back to null.
 */
export interface LiveValue<T> {
  /** The in-flight value, or null when nothing is being dragged. */
  get(): T | null;
  set(value: T | null): void;
  subscribe(listener: () => void): () => void;
}

export function createLiveValue<T>(): LiveValue<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
