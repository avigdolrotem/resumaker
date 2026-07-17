'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { type LanguageLevel } from '@resumaker/shared';
import { Languages, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Languages section — chip-style with level dropdown.
 *
 * The schema requires `level` to be one of the enum values; legacy
 * resumes' free-form levels are normalized at the UI boundary via
 * `normalizeLanguageLevel`.
 */

type Language = NonNullable<Resume['languages']>[number];

const LEVELS: Array<{ value: LanguageLevel; label: string }> = [
  { value: 'native', label: 'Native' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'basic', label: 'Basic' },
];

export interface LanguagesSectionProps {
  languages: Language[];
  onChange: (languages: Language[]) => void;
}

export function LanguagesSection({ languages, onChange }: LanguagesSectionProps) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<LanguageLevel>('professional');

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (languages.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
      setName('');
      return;
    }
    onChange([...languages, { name: trimmed, level }]);
    setName('');
    setLevel('professional');
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <Languages className="text-brand-500 h-4 w-4" />
          Languages
          {languages.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({languages.length})</span>
          )}
        </h2>
      </header>

      <div className="glass-subtle rounded-2xl p-4">
        {languages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {languages.map((l) => (
              <span
                key={l.name}
                className="bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 ease-snappy inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-transform duration-200 hover:-translate-y-0.5"
              >
                {l.name}
                <span className="text-brand-600/70 dark:text-brand-300/70 text-xs">
                  ({l.level})
                </span>
                <button
                  type="button"
                  onClick={() => onChange(languages.filter((x) => x.name !== l.name))}
                  aria-label={`Remove ${l.name}`}
                  className="hover:text-brand-900 dark:hover:text-brand-50 ease-snappy transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Label htmlFor="lang-name" className="sr-only">
              Language name
            </Label>
            <Input
              id="lang-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="e.g. Hebrew, English"
              disabled={languages.length >= 10}
            />
          </div>
          <div>
            <Label htmlFor="lang-level" className="sr-only">
              Level
            </Label>
            <select
              id="lang-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as LanguageLevel)}
              disabled={languages.length >= 10}
              className="border-input bg-background/60 text-foreground focus:border-brand-400/60 focus:bg-background ease-smooth focus:ring-brand-500/18 rounded-xl border px-2.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-4"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" onClick={add} disabled={languages.length >= 10}>
            <Plus className="me-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>
    </section>
  );
}
