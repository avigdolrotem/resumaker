'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { Briefcase, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';
import { AiRewriteButton } from '../ai-rewrite-button';

/**
 * Work Experience section — list of inline-editable cards.
 *
 * Field rules ported from job-app:
 *   - company + title are required, dates are required (start), end is
 *     nullable (Present)
 *   - `is_current` checkbox disables end-date and renders "Present" in
 *     both the picker placeholder and the read view
 *   - `highlights` (bullets) edited as a stack of single-line inputs
 *     with × to remove and "+ Add highlight" to grow the list
 */

type Experience = Resume['experience'][number];

export interface ExperienceSectionProps {
  entries: Experience[];
  onChange: (entries: Experience[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
  /** Optional JD context — enables per-highlight "Rewrite with AI" button. */
  jobDescription?: string | undefined;
}

const EMPTY: Experience = {
  company: '',
  title: '',
  start_date: '',
  end_date: null,
  is_current: false,
  location: '',
  description: '',
  highlights: [],
};

export function ExperienceSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
  jobDescription,
}: ExperienceSectionProps) {
  const [pendingNew, setPendingNew] = useState<Experience | null>(null);

  const newCardId = 'new:experience';

  function handleAdd() {
    setPendingNew({ ...EMPTY });
    onSetEditingId(newCardId);
  }

  function handleSaveExisting(i: number, next: Experience) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: Experience) {
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
          <Briefcase className="text-brand-500 h-4 w-4" />
          Work Experience
          {entries.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({entries.length})</span>
          )}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          aria-label="Add experience"
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
          renderRead={readExperience}
          renderEdit={(d, onChangeDraft) => editExperience(d, onChangeDraft, jobDescription)}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No work experience yet. Click + Add to start.
          </p>
        </div>
      )}

      {entries.map((e, i) => (
        <SectionCard
          key={i}
          data={e}
          isEditing={editingId === `experience:${i}`}
          onEnterEdit={() => onSetEditingId(`experience:${i}`)}
          onSave={(next) => handleSaveExisting(i, next)}
          onCancel={() => onSetEditingId(null)}
          onDelete={() => handleDelete(i)}
          renderRead={readExperience}
          renderEdit={(d, onChangeDraft) => editExperience(d, onChangeDraft, jobDescription)}
          deleteConfirmText={`Delete experience at ${e.company || 'this company'}?`}
        />
      ))}
    </section>
  );
}

function readExperience(e: Experience) {
  return (
    <div>
      <p className="text-foreground font-semibold">{e.title || 'Untitled role'}</p>
      <p className="text-muted-foreground text-sm">
        {e.company}
        {e.location && ` · ${e.location}`}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatMonthYear(e.start_date)} –{' '}
        {e.is_current ? 'Present' : formatMonthYear(e.end_date ?? '')}
      </p>
      {e.description && (
        <p className="text-foreground/80 mt-2 line-clamp-2 text-sm">{e.description}</p>
      )}
      {e.highlights && e.highlights.length > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          {e.highlights.length} highlight{e.highlights.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function editExperience(
  e: Experience,
  onChange: (next: Experience) => void,
  jobDescription?: string,
) {
  const set = <K extends keyof Experience>(k: K, v: Experience[K]) => onChange({ ...e, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="exp-company">Company *</Label>
        <Input
          id="exp-company"
          value={e.company}
          onChange={(ev) => set('company', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="exp-title">Title *</Label>
        <Input
          id="exp-title"
          value={e.title}
          onChange={(ev) => set('title', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="exp-location">Location</Label>
        <Input
          id="exp-location"
          value={e.location ?? ''}
          onChange={(ev) => set('location', ev.target.value)}
          placeholder="City, Country"
        />
      </div>
      <MonthYearPicker
        label="Start"
        value={e.start_date}
        onChange={(v) => set('start_date', v)}
        required
      />
      <MonthYearPicker
        label="End"
        value={e.end_date ?? ''}
        onChange={(v) => set('end_date', v || null)}
        disabled={e.is_current}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={e.is_current}
          onChange={(ev) => {
            const checked = ev.target.checked;
            onChange({ ...e, is_current: checked, end_date: checked ? null : e.end_date });
          }}
          className="rounded"
        />
        Currently working here
      </label>
      <div className="sm:col-span-2">
        <Label htmlFor="exp-desc">Description</Label>
        <Textarea
          id="exp-desc"
          rows={3}
          value={e.description ?? ''}
          onChange={(ev) => set('description', ev.target.value)}
          placeholder="What did you do in this role?"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Highlights</Label>
        <HighlightsEditor
          highlights={e.highlights ?? []}
          onChange={(h) => set('highlights', h)}
          jobDescription={jobDescription}
        />
      </div>
    </div>
  );
}

function HighlightsEditor({
  highlights,
  onChange,
  jobDescription,
}: {
  highlights: string[];
  onChange: (h: string[]) => void;
  jobDescription?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      {highlights.map((h, i) => (
        <div key={i}>
          <div className="flex gap-2">
            <Input
              value={h}
              onChange={(ev) =>
                onChange(highlights.map((x, idx) => (idx === i ? ev.target.value : x)))
              }
              placeholder="• Built a thing that did a thing"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(highlights.filter((_, idx) => idx !== i))}
              aria-label="Remove highlight"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {h.trim().length > 0 && (
            <div className="ms-1 mt-0.5">
              <AiRewriteButton
                value={h}
                jobDescription={jobDescription || ''}
                onReplace={(next) => onChange(highlights.map((x, idx) => (idx === i ? next : x)))}
              />
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...highlights, ''])}
        disabled={highlights.length >= 10}
      >
        <Plus className="me-1 h-3 w-3" />
        Add highlight
      </Button>
    </div>
  );
}
