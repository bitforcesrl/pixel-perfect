import type { Media } from '@/lib/site';

/**
 * A video, a screenshot, or — until either exists — the placeholder drawn by
 * `fallback`.
 *
 * Short clips (`mode: 'loop'`) are muted and looped so they can autoplay;
 * `preload="metadata"` keeps the page light. A walkthrough (`mode: 'player'`)
 * shows its poster with play controls and downloads nothing until played.
 *
 * Screenshots can carry several widths so phones don't download the large one.
 */
export default function MediaSlot({
  media,
  label,
  fallback,
  className = '',
  sizes = '100vw',
}: {
  media: Media;
  /** What the clip or picture shows, read out in its place. */
  label: string;
  fallback: React.ReactNode;
  className?: string;
  /** How wide the slot renders, so the browser picks from `srcSet`. */
  sizes?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-ink-800 bg-ink-950 ${className}`}
    >
      {!media ? (
        fallback
      ) : 'image' in media ? (
        // Pre-sized WebP with its own srcset: next/image would only re-encode it
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.image}
          srcSet={media.srcSet}
          sizes={sizes}
          alt={label}
          className="absolute inset-0 h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <video
          src={media.src}
          poster={media.poster}
          aria-label={label}
          playsInline
          {...(media.mode === 'player'
            ? {
                // A walkthrough: the visitor decides. Nothing but the poster
                // loads until play is pressed; then the file streams in with
                // range requests. Native controls carry fullscreen, which on a
                // phone is the way to watch it large.
                controls: true,
                preload: 'none',
                className: 'h-full w-full bg-ink-950 object-contain',
              }
            : {
                // A short demo clip: muted loops may autoplay everywhere.
                autoPlay: true,
                muted: true,
                loop: true,
                preload: 'metadata',
                className: 'h-full w-full object-cover',
              })}
        />
      )}
    </div>
  );
}
