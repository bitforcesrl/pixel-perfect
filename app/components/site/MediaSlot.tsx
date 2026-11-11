import type { Media } from '@/lib/site';

/**
 * A video, or — until one is recorded — the placeholder drawn by `fallback`.
 *
 * Videos are muted and looped so they can autoplay; `preload="metadata"` keeps
 * the page light when several sit below the fold.
 */
export default function MediaSlot({
  media,
  label,
  fallback,
  className = '',
}: {
  media: Media;
  /** What the clip shows, read out in place of the video. */
  label: string;
  fallback: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-ink-800 bg-ink-950 ${className}`}
    >
      {media ? (
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
      ) : (
        fallback
      )}
    </div>
  );
}
