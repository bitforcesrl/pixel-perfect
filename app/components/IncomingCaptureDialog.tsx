'use client';

import { useState } from 'react';
import Modal from './Modal';
import type { IncomingSite } from '@/lib/extension-bridge';
import type { IncomingChoice, PageRef } from '@/lib/page-match';
import {
  MAX_NAME_LENGTH,
  MAX_PAGES,
  MAX_PROJECTS,
  type Project,
} from '@/lib/projects';

export interface IncomingCaptureDialogProps {
  /** The site sent from the extension's toolbar; null keeps the dialog shut. */
  incoming: IncomingSite | null;
  projects: Project[];
  /** Pages that already compare this address (`findPagesByUrl`). */
  matches: PageRef[];
  /** Where a new page goes unless another project is picked. */
  activeProjectId: string | null;
  onConfirm: (choice: IncomingChoice) => void;
  onClose: () => void;
}

const FIELD =
  'w-full rounded border border-ink-700 bg-ink-850 px-2.5 py-2 text-[12px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-press-violet';
const LABEL =
  'text-[10px] font-medium tracking-[0.12em] text-press-cyan uppercase';
const OPTION =
  'flex cursor-pointer items-start gap-2.5 rounded border border-ink-700 px-3 py-2.5 text-[12px] text-ink-200 transition-colors hover:border-ink-600 has-[:checked]:border-press-violet has-[:checked]:bg-press-violet/10';

/** A short page name from the tab title, or the address's last segment. */
function suggestName(site: IncomingSite): string {
  const fromTitle = site.title.split(/\s[|–—-]\s/)[0]?.trim();
  if (fromTitle) return fromTitle.slice(0, MAX_NAME_LENGTH);
  try {
    const url = new URL(site.url);
    const last = url.pathname.split('/').filter(Boolean).at(-1);
    return (last ?? 'Home').slice(0, MAX_NAME_LENGTH);
  } catch {
    return 'Page';
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'New project';
  }
}

/**
 * Where a site sent from the extension's toolbar ("Open in Pixel Perfect")
 * goes: a page that already has its address, a new page in a project, or —
 * on a first visit with no project at all — a new project. Confirming opens
 * that page and captures it at every viewport of its project.
 */
export default function IncomingCaptureDialog(
  props: IncomingCaptureDialogProps,
) {
  if (!props.incoming) return null;
  // Keyed by address, so a second site sent while open starts a fresh form
  return <Form key={props.incoming.url} {...props} site={props.incoming} />;
}

type Pick = { kind: 'page'; index: number } | { kind: 'new' };

function Form({
  site,
  projects,
  matches,
  activeProjectId,
  onConfirm,
  onClose,
}: IncomingCaptureDialogProps & { site: IncomingSite }) {
  const roomFor = projects.filter(
    (project) => project.pages.length < MAX_PAGES,
  );
  const [pick, setPick] = useState<Pick>(
    matches.length > 0 ? { kind: 'page', index: 0 } : { kind: 'new' },
  );
  const [projectId, setProjectId] = useState<string>(
    roomFor.find((project) => project.id === activeProjectId)?.id ??
      roomFor[0]?.id ??
      '',
  );
  const [name, setName] = useState(() =>
    projects.length === 0 ? hostOf(site.url) : suggestName(site),
  );

  const trimmed = name.trim();
  const noProjects = projects.length === 0;
  const canCreateProject = projects.length < MAX_PROJECTS;

  const blocked =
    pick.kind === 'new'
      ? trimmed.length === 0
        ? 'Give it a name'
        : noProjects
          ? canCreateProject
            ? null
            : 'No room for another project'
          : projectId === ''
            ? `Every project already has ${MAX_PAGES} pages`
            : null
      : null;

  const confirm = () => {
    if (blocked) return;
    if (pick.kind === 'page') {
      const match = matches[pick.index];
      onConfirm({ kind: 'page', ...match });
    } else if (noProjects) {
      onConfirm({ kind: 'new-project', name: trimmed });
    } else {
      onConfirm({ kind: 'new', projectId, name: trimmed });
    }
  };

  const describe = (ref: PageRef) => {
    const project = projects.find((entry) => entry.id === ref.projectId);
    const page = project?.pages.find((entry) => entry.id === ref.pageId);
    return { project: project?.name ?? '', page: page?.name ?? '' };
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Open in Pixel Perfect"
      subtitle="Sent from the Chrome extension"
      size="md"
    >
      <div className="flex flex-col gap-3">
        <p className="rounded border border-ink-700 bg-ink-850 px-2.5 py-2 font-mono text-[11px] break-all text-ink-200">
          {site.url}
        </p>

        <div className="flex flex-col gap-1.5" role="radiogroup">
          {matches.map((match, index) => {
            const { project, page } = describe(match);
            return (
              <label key={match.pageId} className={OPTION}>
                <input
                  type="radio"
                  name="incoming-target"
                  className="mt-0.5 accent-press-violet"
                  checked={pick.kind === 'page' && pick.index === index}
                  onChange={() => setPick({ kind: 'page', index })}
                />
                <span>
                  <span className="text-ink-400">{project} ›</span> {page}
                </span>
              </label>
            );
          })}

          <div className={OPTION}>
            <input
              id="incoming-new"
              type="radio"
              name="incoming-target"
              className="mt-0.5 accent-press-violet"
              checked={pick.kind === 'new'}
              onChange={() => setPick({ kind: 'new' })}
            />
            <span className="flex flex-1 flex-col gap-2">
              <label htmlFor="incoming-new" className="cursor-pointer">
                {noProjects ? 'New project' : 'New page'}
              </label>
              {pick.kind === 'new' && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>
                      {noProjects ? 'Project name' : 'Page name'}
                    </span>
                    <input
                      type="text"
                      value={name}
                      autoFocus
                      maxLength={MAX_NAME_LENGTH}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirm();
                      }}
                      className={FIELD}
                    />
                  </label>
                  {!noProjects && (
                    <label className="flex flex-col gap-1.5">
                      <span className={LABEL}>In project</span>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className={FIELD}
                      >
                        {projects.map((project) => (
                          <option
                            key={project.id}
                            value={project.id}
                            disabled={project.pages.length >= MAX_PAGES}
                          >
                            {project.name}
                            {project.pages.length >= MAX_PAGES
                              ? ` (full, ${MAX_PAGES} pages)`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {noProjects && (
                    <span className="text-[10px] leading-4 text-ink-600">
                      Its first page captures this address.
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <p className="text-[10px] leading-4 text-ink-600">
          The page opens and is captured at every viewport of its project, in
          Chrome, with your session.
        </p>

        <div className="mt-1 flex items-center justify-end gap-2">
          {blocked && (
            <span className="mr-auto text-[11px] text-press-amber">
              {blocked}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={blocked !== null}
            className="rounded border border-press-violet bg-press-violet/15 px-3 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open and capture
          </button>
        </div>
      </div>
    </Modal>
  );
}
