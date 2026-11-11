'use client';

import { useState, useCallback } from 'react';
import {
  addViewport,
  DEFAULT_SETTINGS,
  isLastEnabled,
  removeViewport,
  type ViewportSettings,
} from '@/lib/settings';
import { slotOf, type ViewportKey, type ViewportSlots } from '@/lib/viewports';
import { MIN_DIM, MAX_DIM } from '@/lib/validation';

export interface SettingsPanelProps {
  settings: ViewportSettings;
  onChange: (settings: ViewportSettings) => void;
  slots: ViewportSlots;
}

/** Per-input string state so the user can clear a field to retype. */
function useDimensionInput(
  value: number,
  commit: (n: number) => void,
): [string, (raw: string) => void, () => void] {
  const [text, setText] = useState<string | null>(null);

  const display = text ?? String(value);

  const onChange = useCallback((raw: string) => {
    setText(raw);
  }, []);

  const onBlur = useCallback(() => {
    if (text === null) return;
    const parsed = Number(text);
    const clamped = Number.isFinite(parsed)
      ? Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(parsed)))
      : value;
    setText(null);
    commit(clamped);
  }, [text, value, commit]);

  return [display, onChange, onBlur];
}

function DimensionInput({
  label,
  value,
  commit,
}: {
  label: string;
  value: number;
  commit: (n: number) => void;
}) {
  const [display, onChange, onBlur] = useDimensionInput(value, commit);

  return (
    <div className="flex items-center gap-1">
      <label className="text-[11px] text-ink-500 w-5 shrink-0">{label}</label>
      <input
        type="number"
        value={display}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        min={MIN_DIM}
        max={MAX_DIM}
        step={1}
        className="w-16 rounded border border-ink-600 bg-ink-850 px-1.5 py-1 font-mono text-[11px] text-ink-100 outline-none focus:border-press-violet [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

/** The viewport's name, edited in place and committed on blur or Enter. */
function LabelInput({
  value,
  commit,
}: {
  value: string;
  commit: (label: string) => void;
}) {
  const [text, setText] = useState<string | null>(null);

  const onBlur = () => {
    if (text === null) return;
    const trimmed = text.trim();
    setText(null);
    if (trimmed !== '' && trimmed !== value) commit(trimmed);
  };

  return (
    <input
      type="text"
      aria-label="Viewport name"
      value={text ?? value}
      onChange={(e) => setText(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(null);
      }}
      maxLength={24}
      className="w-24 min-w-0 shrink rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-medium text-ink-200 outline-none hover:border-ink-600 focus:border-press-violet focus:bg-ink-850"
    />
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  slots,
}: SettingsPanelProps) {
  const keys = Object.keys(settings);
  const enabledCount = keys.filter((key) => settings[key].enabled).length;

  const toggle = (key: ViewportKey) => {
    if (!settings[key].enabled && isLastEnabled(settings, key)) return;
    onChange({
      ...settings,
      [key]: { ...settings[key], enabled: !settings[key].enabled },
    });
  };

  const setWidth = (key: ViewportKey, width: number) => {
    onChange({
      ...settings,
      [key]: { ...settings[key], width },
    });
  };

  const setHeight = (key: ViewportKey, height: number) => {
    onChange({
      ...settings,
      [key]: { ...settings[key], height },
    });
  };

  const setLabel = (key: ViewportKey, label: string) => {
    onChange({
      ...settings,
      [key]: { ...settings[key], label },
    });
  };

  const add = () => {
    onChange(addViewport(settings).settings);
  };

  const remove = (key: ViewportKey) => {
    onChange(removeViewport(settings, key));
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_SETTINGS);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-5 text-ink-500">
        Add the viewports this project is designed for, choose which to capture
        and at what size. The Figma routing uses the configured widths to decide
        where each export lands. Removing a viewport drops its captures and
        exports on every page of the project.
      </p>

      <div className="flex flex-col gap-2">
        {keys.map((key) => {
          const setting = settings[key];
          const slot = slotOf(slots, key);
          const last = setting.enabled && isLastEnabled(settings, key);
          const stale =
            slot.screenshot !== null && slot.screenshot.width !== setting.width;

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 rounded border border-ink-800 bg-ink-850/50 px-2 py-1.5">
                <input
                  type="checkbox"
                  id={`vp-${key}`}
                  checked={setting.enabled}
                  onChange={() => toggle(key)}
                  disabled={last}
                  title={
                    last
                      ? 'Cannot disable the last enabled viewport'
                      : undefined
                  }
                  className="accent-press-violet"
                />
                <LabelInput
                  value={setting.label}
                  commit={(label) => setLabel(key, label)}
                />
                <DimensionInput
                  label="W"
                  value={setting.width}
                  commit={(n) => setWidth(key, n)}
                />
                <span className="text-[11px] text-ink-500">×</span>
                <DimensionInput
                  label="H"
                  value={setting.height}
                  commit={(n) => setHeight(key, n)}
                />
                <button
                  type="button"
                  onClick={() => remove(key)}
                  disabled={last}
                  aria-label={`Remove ${setting.label}`}
                  title={
                    last
                      ? 'Cannot remove the last enabled viewport'
                      : `Remove ${setting.label}`
                  }
                  className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[13px] leading-none text-ink-500 transition-colors hover:bg-ink-800 hover:text-press-red disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-500"
                >
                  ×
                </button>
              </div>
              {stale && (
                <p className="pl-2 text-[11px] text-press-amber">
                  Captured at {slot.screenshot!.width}×{slot.screenshot!.height}{' '}
                  — re-capture to apply
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          className="rounded border border-dashed border-ink-600 px-2 py-1.5 text-[11px] text-ink-400 transition-colors hover:border-press-violet hover:text-ink-100"
        >
          + Add viewport
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-ink-800 pt-2">
        <span className="font-mono text-[11px] text-ink-500">
          {enabledCount}/{keys.length} enabled
        </span>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-[11px] text-ink-500 underline underline-offset-2 transition-colors hover:text-ink-200"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
