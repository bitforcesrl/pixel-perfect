import { DOCS_TOC, docsHref, type DocsTocEntry } from '@/lib/docs';
import { SITE } from '@/lib/site';

/**
 * /llms.txt — a plain-Markdown map of the site for LLMs (llmstxt.org).
 *
 * Assistants answering "is there a tool that compares Figma with the live
 * site?" read this instead of parsing the landing page's markup. The docs
 * links come from the same table of contents the /docs page renders, so
 * they cannot drift from the real anchors. Built once at deploy time.
 */
export const dynamic = 'force-static';

const docsLines = (entries: DocsTocEntry[], depth = 0): string[] =>
  entries.flatMap((entry) => [
    `${'  '.repeat(depth)}- [${entry.title}](${SITE.url}${docsHref(entry.id)})`,
    ...docsLines(entry.children ?? [], depth + 1),
  ]);

const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is a free, open-source (MIT) web app for design QA. For each page
and viewport (mobile, tablet, desktop or custom widths) it stacks a screenshot
of the live website over the matching Figma frame, so developers, QA testers
and designers can see where the build drifts from the design.

## What it does

- Four comparison modes: Split (a draggable seam), Overlay (opacity or
  difference blending, where mismatches glow), Tap (hold to flip between
  build and design) and Side by side (synced scroll).
- Three setup levels: drag and drop two images with nothing to configure;
  paste a Figma frame link with a Figma personal access token to render the
  design per viewport; capture the site full-page automatically with a
  Browserless cloud browser or a local Firefox (localhost and logged-in pages).
- Align, measure, guides, pen and notes; snapshot history; a whole project
  exported and shared as a single ZIP.
- Runs in any browser, installable as a PWA, self-hostable with Node.js or
  Docker. No account, projects stay in the browser.

## Links

- [Website](${SITE.url})
- [Open the app](${SITE.url}/app)
- [Live demo](${SITE.url}/demo)
- [Source code on GitHub](${SITE.githubUrl})

## Docs

${docsLines(DOCS_TOC).join('\n')}
`;

export function GET() {
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
