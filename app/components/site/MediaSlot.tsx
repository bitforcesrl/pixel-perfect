import type { Media } from '@/lib/site';

/**
 * A video, a screenshot, or — until either exists — the placeholder drawn by
 * `fallback`.
 *
 * Videos are muted and looped so they can autoplay; `preload="metadata"` keeps
 * the page light when several sit below the fold.
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
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}
