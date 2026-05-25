'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { FolderGit2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';

/**
 * Projects section — list of inline-editable cards.
 *
 * Richer than Experience: includes a URL, a comma-typed technologies
 * tag input (commits on `,` / Enter / blur), an "Ongoing / active"
 * toggle, and a line-clamped description in the read view.
 */

type Project = NonNullable<Resume['projects']>[number];

export interface ProjectsSectionProps {
  entries: Project[];
  onChange: (entries: Project[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const EMPTY: Project = {
  name: '',
  description: '',
  technologies: [],
  url: undefined,
  start_date: '',
  end_date: null,
  is_ongoing: false,
};

export function ProjectsSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
}: ProjectsSectionProps) {
  const [pendingNew, setPendingNew] = useState<Project | null>(null);
  const newCardId = 'new:project';

  function handleAdd() {
    setPendingNew({ ...EMPTY });
    onSetEditingId(newCardId);
  }

  function handleSaveExisting(i: number, next: Project) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: Project) {
    onChange([next, ...entries]);
    setPendingNew(null);
    onSetEditingId(null);
  }

  function handleDelete(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
    onSetEditingId(null);
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <FolderGit2 className="text-brand-500 h-4 w-4" />
          Projects
          {entries.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({entries.length})</span>
          )}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          aria-label="Add project"
          disabled={pendingNew !== null}
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          Add
        </Button>
      </header>

      {pendingNew && editingId === newCardId && (
        <SectionCard
          data={pendingNew}
          isEditing
          onEnterEdit={() => {}}
          onSave={handleSaveNew}
          onCancel={() => {
            setPendingNew(null);
            onSetEditingId(null);
          }}
          onDelete={() => {
            setPendingNew(null);
            onSetEditingId(null);
          }}
          renderRead={readProject}
          renderEdit={editProject}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">No projects yet. Click + Add to add one.</p>
        </div>
      )}

      {entries.map((p, i) => (
        <SectionCard
          key={i}
          data={p}
          isEditing={editingId === `project:${i}`}
          onEnterEdit={() => onSetEditingId(`project:${i}`)}
          onSave={(next) => handleSaveExisting(i, next)}
          onCancel={() => onSetEditingId(null)}
          onDelete={() => handleDelete(i)}
          renderRead={readProject}
          renderEdit={editProject}
          deleteConfirmText={`Delete project "${p.name || 'untitled'}"?`}
        />
      ))}
    </section>
  );
}

function readProject(p: Project) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-foreground font-semibold">{p.name || 'Untitled project'}</p>
        {p.is_ongoing && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
            Ongoing
          </span>
        )}
      </div>
      {(p.start_date || p.end_date) && (
        <p className="text-muted-foreground text-xs">
          {formatMonthYear(p.start_date ?? '')} –{' '}
          {p.is_ongoing ? 'Present' : formatMonthYear(p.end_date ?? '')}
        </p>
      )}
      {p.url && (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-brand-600 hover:text-brand-700 mt-1 inline-block max-w-[260px] truncate text-xs underline"
        >
          {p.url.replace(/^https?:\/\//, '')}
        </a>
      )}
      {p.technologies && p.technologies.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {p.technologies.map((t) => (
            <span key={t} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      )}
      {p.description && (
        <p className="text-foreground/80 mt-2 line-clamp-2 text-sm">{p.description}</p>
      )}
    </div>
  );
}

function editProject(p: Project, onChange: (next: Project) => void) {
  const set = <K extends keyof Project>(k: K, v: Project[K]) => onChange({ ...p, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="proj-name">Project name *</Label>
        <Input
          id="proj-name"
          value={p.name}
          onChange={(ev) => set('name', ev.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="proj-url">URL</Label>
        <Input
          id="proj-url"
          type="url"
          value={p.url ?? ''}
          onChange={(ev) => set('url', ev.target.value || undefined)}
          placeholder="https://github.com/..."
        />
      </div>
      <MonthYearPicker
        label="Start"
        value={p.start_date ?? ''}
        onChange={(v) => set('start_date', v)}
      />
      <MonthYearPicker
        label="End"
        value={p.end_date ?? ''}
        onChange={(v) => set('end_date', v || null)}
        disabled={p.is_ongoing}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={p.is_ongoing}
          onChange={(ev) => {
            const checked = ev.target.checked;
            onChange({ ...p, is_ongoing: checked, end_date: checked ? null : p.end_date });
          }}
          className="rounded"
        />
        Ongoing / active
      </label>
      <div className="sm:col-span-2">
        <Label>Technologies</Label>
        <TechChipsInput value={p.technologies ?? []} onChange={(t) => set('technologies', t)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="proj-desc">Description</Label>
        <Textarea
          id="proj-desc"
          rows={3}
          value={p.description}
          onChange={(ev) => set('description', ev.target.value)}
          placeholder="What did you build? What problem did it solve?"
        />
      </div>
    </div>
  );
}

function TechChipsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState('');

  function commit(text: string) {
    const trimmed = text.trim();
    if (trimmed && !value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setRaw('');
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {value.map((t) => (
            <span
              key={t}
              className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={raw}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) {
            commit(e.target.value.slice(0, -1));
          } else {
            setRaw(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(raw);
          }
        }}
        onBlur={() => commit(raw)}
        placeholder="React, TypeScript, AWS…"
        disabled={value.length >= 20}
      />
      <p className="text-muted-foreground mt-1 text-xs">Type and press , or Enter to add</p>
    </div>
  );
}
