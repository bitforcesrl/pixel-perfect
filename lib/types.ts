/**
 * How the Figma layer is composited over the capture.
 *
 * Two modes, because two is what the job needs: normal to look at the design
 * on top of the site, difference to make everything that matches go black and
 * everything that moved light up. The other CSS blend modes looked like
 * options without answering a question anyone was asking.
 */
export type BlendMode = 'normal' | 'difference';
export type ViewMode = 'overlay' | 'split' | 'tap' | 'sideBySide';

export const BLEND_MODES: BlendMode[] = ['normal', 'difference'];
