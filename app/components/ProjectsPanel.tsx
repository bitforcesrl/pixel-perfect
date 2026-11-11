'use client';

import { useState } from 'react';
import { MAX_NAME_LENGTH, type Project } from '@/lib/projects';

export interface ProjectsPanelProps {
  projects: Project[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const NAME_INPUT =
  'w-full rounded border border-ink-600 bg-ink-850 px-2 py-1.5 text-[12px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-press-violet';

export default function ProjectsPanel({
  projects,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ProjectsPanelProps) {
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  // Delete asks once, in place: the project's captures and notes go with it
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const create = () => {
    const trimmed = newName.trim();
    if (trimmed.length === 0) return;
    onCreate(trimmed);
    setNewName('');
  };

  const commitRename = () => {
    if (renamingId === null) return;
    const trimmed = renameText.trim();
    if (trimmed.length > 0) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-5 text-ink-500">
        Each project keeps its own pages and viewport settings; each page its
        own URL, captures, Figma exports, snapshots and notes.
      </p>

      <div className="flex flex-col gap-1.5">
        {projects.map((project) => {
          const active = project.id === activeId;
          const renaming = renamingId === project.id;
          const confirming = confirmingId === project.id;

          return (
            <div
              key={project.id}
              className={`rounded border px-2 py-1.5 ${
                active
                  ? 'border-press-violet bg-press-violet/10'
                  : 'border-ink-800 bg-ink-850/50'
              }`}
            >
              {renaming ? (
                <input
                  type="text"
                  value={renameText}
                  autoFocus
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className={NAME_INPUT}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    disabled={active}
                    title={project.pages.map((page) => page.name).join(', ')}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <span
                      className={`block truncate text-[12px] font-medium ${
                        active ? 'text-press-violet' : 'text-ink-200'
                      }`}
                    >
                      {project.name}
                    </span>
                    <span className="block truncate text-[10px] text-ink-500">
                      {project.pages.length === 1
                        ? '1 page'
                        : `${project.pages.length} pages`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(project.id);
                      setRenameText(project.name);
                      setConfirmingId(null);
                    }}
                    title="Rename"
                    className="rounded px-1.5 py-1 text-[10px] text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      confirming
                        ? onDelete(project.id)
                        : setConfirmingId(project.id)
                    }
                    onBlur={() => setConfirmingId(null)}
                    disabled={projects.length === 1}
                    title={
                      projects.length === 1
                        ? 'The last project cannot be deleted'
                        : 'Delete this project and everything in it'
                    }
                    className={`rounded px-1.5 py-1 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      confirming
                        ? 'bg-press-red/15 text-press-red'
                        : 'text-ink-500 hover:bg-ink-800 hover:text-press-red'
                    }`}
                  >
                    {confirming ? 'Sure?' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t border-ink-800 pt-3">
        <input
          type="text"
          value={newName}
          maxLength={MAX_NAME_LENGTH}
          placeholder="New project name"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          className={NAME_INPUT}
        />
        <button
          type="button"
          onClick={create}
          disabled={newName.trim().length === 0}
          className="shrink-0 rounded border border-press-violet bg-press-violet/15 px-2.5 py-1.5 text-[11px] font-medium text-press-violet transition-colors hover:bg-press-violet/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
