/**
 * The Pixel Perfect brand mark: two ink discs laid slightly out of register
 * over a crosshair. Cyan is the site capture, magenta the Figma export, and the
 * violet lens is where the two layers agree — the same colour logic the tool
 * uses on the canvas.
 *
 * Dumb, server-safe component (no hooks): the overlap is drawn as an explicit
 * lens path instead of a clipPath, so several marks on one page never collide
 * on element ids. Neutral strokes use `currentColor`, so the mark follows the
 * text colour of wherever it is placed.
 */
export default function BrandMark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  // A 2-unit stroke on a 64-unit grid drops below one device pixel at favicon
  // sizes, so small marks get a heavier crosshair to stay visible.
  const crosshair = size <= 20 ? 4 : 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      <circle cx="27" cy="32" r="16" fill="var(--color-press-cyan)" />
      <circle cx="37" cy="32" r="16" fill="var(--color-press-magenta)" />
      {/* Intersection of the two discs: right edge of the cyan disc, left
          edge of the magenta one */}
      <path
        d="M32 16.8A16 16 0 0 1 32 47.2A16 16 0 0 1 32 16.8Z"
        fill="var(--color-press-violet)"
      />
      <path
        d="M32 4v56M4 32h56"
        stroke="currentColor"
        strokeWidth={crosshair}
      />
    </svg>
  );
}
