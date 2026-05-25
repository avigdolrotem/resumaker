'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COMMON_SKILLS } from '@/lib/data/common-skills';

/**
 * Skills section — chip-style, add+delete only (no inline edit).
 *
 * Autocomplete dropdown sources from a bundled 200-skill list, with
 * user's existing skills filtered out so we don't suggest duplicates.
 * Case-insensitive de-dupe on commit so "react" / "React" / "REACT"
 * collapse to one entry.
 */

export interface SkillsSectionProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

export function SkillsSection({ skills, onChange }: SkillsSectionProps) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <Sparkles className="text-brand-500 h-4 w-4" />
          Skills
          {skills.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({skills.length})</span>
          )}
        </h2>
      </header>

      <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
        {skills.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm"
              >
                {s}
                <button
                  type="button"
                  onClick={() => onChange(skills.filter((x) => x !== s))}
                  aria-label={`Remove ${s}`}
                  className="hover:text-brand-900 dark:hover:text-brand-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mb-3 text-sm">
            No skills yet. Start typing below — we'll suggest from common ones.
          </p>
        )}
        <SkillAutocompleteInput
          existing={skills}
          onAdd={(s) => onChange([...skills, s])}
          disabled={skills.length >= 50}
        />
        {skills.length >= 50 && (
          <p className="text-muted-foreground mt-1 text-xs">
            Maximum 50 skills — remove some to add more.
          </p>
        )}
      </div>
    </section>
  );
}

function SkillAutocompleteInput({
  existing,
  onAdd,
  disabled,
}: {
  existing: string[];
  onAdd: (skill: string) => void;
  disabled?: boolean;
}) {
  const [raw, setRaw] = useState('');
  const lower = raw.toLowerCase().trim();
  const existingLower = new Set(existing.map((s) => s.toLowerCase()));
  const suggestions = lower
    ? COMMON_SKILLS.filter(
        (s) => s.toLowerCase().includes(lower) && !existingLower.has(s.toLowerCase()),
      ).slice(0, 8)
    : [];

  function commit(text: string) {
    const trimmed = text.trim();
    if (trimmed && !existingLower.has(trimmed.toLowerCase())) {
      onAdd(trimmed);
    }
    setRaw('');
  }

  return (
    <div className="relative">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(raw);
          }
        }}
        placeholder="Add a skill (e.g. TypeScript)"
        disabled={disabled}
      />
      {suggestions.length > 0 && (
        <div className="border-border bg-card absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="hover:bg-muted block w-full px-3 py-1.5 text-start text-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
