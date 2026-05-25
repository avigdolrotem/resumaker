'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { GraduationCap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { SortableList } from '../sortable-list';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';

/**
 * Education section — list of inline-editable cards.
 *
 * Unlike job-app (which has no "currently studying" toggle), we add
 * an `is_current` checkbox here to match Experience. Useful for
 * students enrolling in long programs.
 */

type Education = Resume['education'][number];

export interface EducationSectionProps {
  entries: Education[];
  onChange: (entries: Education[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const EMPTY: Education = {
  institution: '',
  degree: '',
  field: '',
  start_date: '',
  end_date: null,
  is_current: false,
  gpa: '',
  description: '',
};

export function EducationSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
}: EducationSectionProps) {
  const [pendingNew, setPendingNew] = useState<Education | null>(null);
  const newCardId = 'new:education';

  function handleAdd() {
    setPendingNew({ ...EMPTY });
    onSetEditingId(newCardId);
  }

  function handleSaveExisting(i: number, next: Education) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: Education) {
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
          <GraduationCap className="text-brand-500 h-4 w-4" />
          Education
          {entries.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({entries.length})</span>
          )}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          aria-label="Add education"
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
          renderRead={readEducation}
          renderEdit={editEducation}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No education entries yet. Click + Add to start.
          </p>
        </div>
      )}

      <SortableList items={entries} sectionKey="education" onReorder={onChange}>
        {(e, i, dragHandle) => (
          <SectionCard
            data={e}
            isEditing={editingId === `education:${i}`}
            onEnterEdit={() => onSetEditingId(`education:${i}`)}
            onSave={(next) => handleSaveExisting(i, next)}
            onCancel={() => onSetEditingId(null)}
            onDelete={() => handleDelete(i)}
            renderRead={readEducation}
            renderEdit={editEducation}
            deleteConfirmText={`Delete education at ${e.institution || 'this school'}?`}
            leading={dragHandle}
          />
        )}
      </SortableList>
    </section>
  );
}

function readEducation(e: Education) {
  return (
    <div>
      <p className="text-foreground font-semibold">{e.institution || 'Untitled institution'}</p>
      <p className="text-muted-foreground text-sm">
        {e.degree}
        {e.field && ` · ${e.field}`}
        {e.gpa && ` · GPA: ${e.gpa}`}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatMonthYear(e.start_date)} –{' '}
        {e.is_current ? 'Present' : formatMonthYear(e.end_date ?? '')}
      </p>
    </div>
  );
}

function editEducation(e: Education, onChange: (next: Education) => void) {
  const set = <K extends keyof Education>(k: K, v: Education[K]) => onChange({ ...e, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="edu-institution">Institution *</Label>
        <Input
          id="edu-institution"
          value={e.institution}
          onChange={(ev) => set('institution', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="edu-degree">Degree</Label>
        <Input
          id="edu-degree"
          value={e.degree}
          onChange={(ev) => set('degree', ev.target.value)}
          placeholder="e.g. B.Sc., M.Eng."
        />
      </div>
      <div>
        <Label htmlFor="edu-field">Field of study</Label>
        <Input
          id="edu-field"
          value={e.field ?? ''}
          onChange={(ev) => set('field', ev.target.value)}
          placeholder="e.g. Computer Science"
        />
      </div>
      <MonthYearPicker label="Start" value={e.start_date} onChange={(v) => set('start_date', v)} />
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
        Currently studying
      </label>
      <div>
        <Label htmlFor="edu-gpa">GPA</Label>
        <Input
          id="edu-gpa"
          value={e.gpa ?? ''}
          onChange={(ev) => set('gpa', ev.target.value)}
          placeholder="e.g. 3.8 or 95/100"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="edu-desc">Description</Label>
        <Textarea
          id="edu-desc"
          rows={2}
          value={e.description ?? ''}
          onChange={(ev) => set('description', ev.target.value)}
          placeholder="Honors, relevant coursework, thesis…"
        />
      </div>
    </div>
  );
}
