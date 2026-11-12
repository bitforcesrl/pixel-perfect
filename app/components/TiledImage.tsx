'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { loadTiles, peekTiles, type Tiles } from '@/lib/tiles';

export interface TiledImageProps {
  src: string;
  alt: string;
  /** Sizes the column; the strips fill its width and stack to its height */
  className?: string;
  style?: React.CSSProperties;
  /** Natural size of the whole image, once it is known */
  onSize?: (width: number, height: number) => void;
}

/**
 * An image drawn as a column of strips — see `lib/tiles.ts` for why.
 *
 * Lays out exactly like the one `<img>` it replaces: each strip carries its
 * natural size, so the column has its height before any strip has decoded.
 *
 * Memoised: a drag re-renders the viewer around it many times a second, and
 * a full-page capture is dozens of strips that have nothing to update.
 */
export default memo(function TiledImage({
  src,
  alt,
  className = '',
  style,
  onSize,
}: TiledImageProps) {
  // Tagged with the src it came from, so a new src never paints the old strips
  const [loaded, setLoaded] = useState<{ src: string; tiles: Tiles } | null>(
    null,
  );
  // Already cut — the usual case once the background pass has run — paints on
  // the first render, with no frame of empty canvas
  const tiles = loaded?.src === src ? loaded.tiles : peekTiles(src);

  useEffect(() => {
    if (peekTiles(src)) return;
    let cancelled = false;
    loadTiles(src).then(
      (next) => {
        if (!cancelled) setLoaded({ src, tiles: next });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [src]);

  const onSizeRef = useRef(onSize);
  useEffect(() => {
    onSizeRef.current = onSize;
  });
  const width = tiles?.width;
  const height = tiles?.height;
  useEffect(() => {
    if (width && height) onSizeRef.current?.(width, height);
  }, [src, width, height]);

  return (
    <div role="img" aria-label={alt} className={className} style={style}>
      {tiles?.strips.map((strip) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={strip.src}
          src={strip.src}
          alt=""
          width={tiles.width}
          height={strip.height}
          decoding="async"
          draggable={false}
          className="block h-auto w-full max-w-none"
        />
      ))}
    </div>
  );
});
