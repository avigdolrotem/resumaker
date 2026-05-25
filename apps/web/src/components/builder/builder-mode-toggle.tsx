'use client';

import { Sparkles, ListChecks } from 'lucide-react';

/**
 * Basic / Advanced switcher at the top of the builder.
 *
 *   - Basic    — the original simple form (paste a JD + a quick profile,
 *                AI fills in the gaps). Best for first-time users + people
 *                who don't have a polished resume yet.
 *   - Advanced — the full builder with per-entry add/edit/delete cards,
 *                MM/YYYY date pickers, projects, awards, etc. Best for
 *                experienced users + people importing an existing resume.
 *
 * The user's choice is held in URL state (`?mode=advanced`) so it
 * persists across reload and back-button + is shareable for support
 * conversations. Both modes share the same underlying resume data, so
 * switching back and forth doesn't lose anything.
 */

export type BuilderMode = 'basic' | 'advanced';

export function BuilderModeToggle({
  mode,
  onChange,
}: {
  mode: BuilderMode;
  onChange: (m: BuilderMode) => void;
}) {
  return (
    <div className="border-border bg-card inline-flex items-center gap-1 rounded-xl border p-1 shadow-sm">
      <ModeButton
        active={mode === 'basic'}
        onClick={() => onChange('basic')}
        Icon={Sparkles}
        label="Basic"
        hint="AI-assisted"
      />
      <ModeButton
        active={mode === 'advanced'}
        onClick={() => onChange('advanced')}
        Icon={ListChecks}
        label="Advanced"
        hint="Full control"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Sparkles;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? 'from-brand-600 to-brand-700 shadow-brand-500/30 bg-gradient-to-br text-white shadow-md'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      <span
        className={`hidden text-[10px] font-normal lg:inline ${
          active ? 'text-white/80' : 'text-muted-foreground/70'
        }`}
      >
        · {hint}
      </span>
    </button>
  );
}
