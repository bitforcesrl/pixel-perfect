const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago something was saved, truncated — "3m ago", "2h ago", "5d ago". */
export function elapsedLabel(savedAt: number, now: number): string {
  const ms = Math.max(0, now - savedAt);
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The wall clock a snapshot was saved at, in the viewer's own time zone —
 * "2026-07-29 14:32". Built from the local getters rather than `toLocale*`
 * so the format is stable across locales, and sorts the way it reads.
 */
export function savedAtLabel(savedAt: number): string {
  const date = new Date(savedAt);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
