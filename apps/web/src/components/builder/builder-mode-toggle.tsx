'use client';

import { motion } from 'framer-motion';
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
    <div className="glass-subtle inline-flex items-center gap-1 rounded-2xl p-1">
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
      aria-label={`${label} — ${hint}`}
      className={`ease-snappy group relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 active:scale-[0.96] ${
        active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {/* Sliding active pill — shared `layoutId` across both buttons so
          framer-motion animates it between Basic/Advanced instead of it
          just popping into place, matching the header NavLink pattern. */}
      {active && (
        <motion.span
          layoutId="builder-mode-active-pill"
          className="from-brand-600 to-brand-700 shadow-brand-500/30 absolute inset-0 -z-10 rounded-xl bg-gradient-to-br shadow-md"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      {!active && (
        <span
          aria-hidden
          className="bg-muted absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
      <Icon className="h-4 w-4" />
      <span>{label}</span>
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
