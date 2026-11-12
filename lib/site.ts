/**
 * Everything on the public site that changes without touching layout:
 * links, and the media slots.
 *
 * A media slot set to `null` renders a drawn placeholder, so the page looks
 * finished before any media exists. Drop a file into `public/media/` and put
 * its path here to replace the placeholder: a video, or a screenshot.
 */

export type VideoMedia = {
  /** An .mp4 or .webm under /public, played muted, looped and inline. */
  src: string;
  /** Still frame shown before the video loads (optional). */
  poster?: string;
  /**
   * `loop` (default): muted, looped, autoplaying clip, for short demos.
   * `player`: a real player with controls and fullscreen. Nothing is
   * downloaded until the visitor presses play, then it streams.
   */
  mode?: 'loop' | 'player';
};

export type ImageMedia = {
  /** A .webp under /public, 16:10; the fallback `src`. */
  image: string;
  /** Other widths of the same picture, as an `srcset` (optional). */
  srcSet?: string;
};

export type Media = VideoMedia | ImageMedia | null;

/**
 * Screenshots of the real app running the demo project: tablet page, app
 * window 1200×750 at 2x (kept compact so the UI stays legible when small).
 * Re-shot by hand after UI changes.
 */
const modeShot = (mode: string): ImageMedia => ({
  image: `/media/mode-${mode}.webp`,
  srcSet: [
    `/media/mode-${mode}-960.webp 960w`,
    `/media/mode-${mode}.webp 1600w`,
    `/media/mode-${mode}-2400.webp 2400w`,
  ].join(', '),
});

export const SITE = {
  name: 'Pixel Perfect',
  tagline: "See every pixel that doesn't match.",
  description:
    'Stack the live site on its Figma design, per page and per viewport, and find the drift in seconds. Free and open source.',
  /** Copyright holder, as in the LICENSE */
  author: 'Tommaso Rossi',
  /** Public address of the site, used for absolute URLs (metadata, sitemap) */
  url: 'https://pixelperfect.fit',
  /** `owner/name` on GitHub, used to read the star count */
  githubRepo: 'bitforcesrl/pixel-perfect',
  githubUrl: 'https://github.com/bitforcesrl/pixel-perfect',
  /** The full walkthrough, also used on Product Hunt. Optional. */
  youtubeUrl: null as string | null,
  media: {
    // Hero walkthrough (about 45 s), exported as MP4 from the Motion film.
    // Played on demand only: the poster shows until the visitor presses play.
    hero: {
      src: '/media/hero.mp4',
      poster: '/media/hero-poster.jpg',
      mode: 'player',
    } as Media,
    split: modeShot('split') as Media,
    overlay: modeShot('overlay') as Media,
    tap: modeShot('tap') as Media,
    sideBySide: modeShot('side') as Media,
  },
} as const;
