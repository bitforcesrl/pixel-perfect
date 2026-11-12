/**
 * A screenshot of the app, with a caption.
 *
 * Pre-sized WebP files, so a plain `<img>`: `next/image` would only re-encode
 * them (same reasoning as the landing page's `MediaSlot`). `width`/`height`
 * reserve the space before the file arrives, so the page does not jump while
 * reading, and `loading="lazy"` keeps the shots below the fold off the wire.
 */
export default function Figure({
  src,
  srcSet,
  sizes,
  width,
  height,
  alt,
  caption,
  displayWidth,
}: {
  /** Path under /public */
  src: string;
  /** Other widths of the same picture (optional) */
  srcSet?: string;
  sizes?: string;
  /** Intrinsic size of `src`, in pixels */
  width: number;
  height: number;
  /** What the picture shows, read out in its place */
  alt: string;
  caption?: React.ReactNode;
  /**
   * Shown width, in CSS px (never wider than the column). Crops of a 2x
   * screen are shown at half their size so the UI reads at its real scale.
   */
  displayWidth?: number;
}) {
  return (
    // A definite width, not just a cap: in an auto-sized column (WithAside)
    // a not-yet-loaded image would otherwise be 0 px wide, and the page
    // would jump — and miss an anchor it had just scrolled to — on load
    <figure
      className="flex flex-col gap-3"
      style={
        displayWidth ? { width: displayWidth, maxWidth: '100%' } : undefined
      }
    >
      <div className="overflow-hidden rounded-md border border-ink-800 bg-ink-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          width={width}
          height={height}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
      {caption && (
        <figcaption className="text-xs leading-relaxed text-ink-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** A full-window shot, at 960 and 1600 px wide. */
export function WindowShot({
  name,
  alt,
  caption,
}: {
  /** File name in /public/docs, without `.webp` */
  name: string;
  alt: string;
  caption?: React.ReactNode;
}) {
  return (
    <Figure
      src={`/docs/${name}.webp`}
      srcSet={`/docs/${name}-960.webp 960w, /docs/${name}.webp 1600w`}
      sizes="(min-width: 1152px) 768px, calc(100vw - 32px)"
      width={1600}
      height={1000}
      alt={alt}
      caption={caption}
    />
  );
}
