'use client';

import GitHubButton from 'react-github-btn';
import { SITE } from '@/lib/site';

/**
 * GitHub's official "Star" button with the live star count
 * (buttons.github.io, via `react-github-btn`).
 *
 * The button script loads after hydration, so the wrapper reserves its size
 * up front to keep the header from shifting. If the script is blocked
 * (ad blocker, offline) the fallback link inside still leads to the repo.
 */
export default function GitHubStarBadge({
  className = '',
}: {
  className?: string;
}) {
  return (
    <span className={`h-5 min-w-[92px] items-center ${className}`}>
      <GitHubButton
        href={SITE.githubUrl}
        data-color-scheme="no-preference: dark; light: dark; dark: dark;"
        data-icon="octicon-star"
        data-show-count="true"
        aria-label="Star Pixel Perfect on GitHub"
      >
        Star
      </GitHubButton>
    </span>
  );
}
