/**
 * Everything on the public site that changes without touching layout:
 * links, and the media slots.
 *
 * A media slot set to `null` renders a drawn placeholder, so the page looks
 * finished before any video exists. Drop a file into `public/media/` and put
 * its path here to replace the placeholder.
 */

export type Media = {
  /** An .mp4 or .webm under /public, played muted, looped and inline. */
  src: string;
  /** Still frame shown before the video loads (optional). */
  poster?: string;
} | null;

export const SITE = {
  name: 'Pixel Perfect',
  tagline: "See every pixel that doesn't match.",
  description:
    'Stack the live site on its Figma design, per page and per viewport, and find the drift in seconds. Free and open source.',
  githubUrl: 'https://github.com/bitforcesrl/pixel-perfect',
  /** The full walkthrough, also used on Product Hunt. Optional. */
  youtubeUrl: null as string | null,
  media: {
    hero: null as Media, // e.g. { src: '/media/hero.mp4', poster: '/media/hero.jpg' }
    split: null as Media,
    overlay: null as Media,
    tap: null as Media,
    sideBySide: null as Media,
  },
} as const;
