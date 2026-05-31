'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Resume } from '@resumaker/shared';
import { Trophy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { SortableList } from '../sortable-list';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';

type T = ReturnType<typeof useTranslations>;

/** Awards section — list of cards. Title + issuer + date + description. */

type AwardEntry = NonNullable<Resume['awards']>[number];

export interface AwardsSectionProps {
  entries: AwardEntry[];
  onChange: (entries: AwardEntry[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const EMPTY: AwardEntry = {
  title: '',
  issuer: '',
  date: '',
  description: '',
};

export function AwardsSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
}: AwardsSectionProps) {
  const t = useTranslations('builder.sections.awards');
  const locale = useLocale();
  const [pendingNew, setPendingNew] = useState<AwardEntry | null>(null);
  const newCardId = 'new:award';

  function handleAdd() {
    setPendingNew({ ...EMPTY });
    onSetEditingId(newCardId);
  }

  function handleSaveExisting(i: number, next: AwardEntry) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: AwardEntry) {
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
          <Trophy className="text-brand-500 h-4 w-4" />
          {t('heading')}
          {entries.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({entries.length})</span>
          )}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          aria-label={t('addAria')}
          disabled={pendingNew !== null}
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          {t('add')}
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
          renderRead={(d) => readAward(d, t, locale)}
          renderEdit={(d, onChangeDraft) => editAward(d, onChangeDraft, t)}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        </div>
      )}

      <SortableList items={entries} sectionKey="award" onReorder={onChange}>
        {(a, i, dragHandle) => (
          <SectionCard
            data={a}
            isEditing={editingId === `award:${i}`}
            onEnterEdit={() => onSetEditingId(`award:${i}`)}
            onSave={(next) => handleSaveExisting(i, next)}
            onCancel={() => onSetEditingId(null)}
            onDelete={() => handleDelete(i)}
            renderRead={(d) => readAward(d, t, locale)}
            renderEdit={(d, onChangeDraft) => editAward(d, onChangeDraft, t)}
            deleteConfirmText={t('deleteConfirm', { title: a.title || t('deleteFallback') })}
            leading={dragHandle}
          />
        )}
      </SortableList>
    </section>
  );
}

function readAward(a: AwardEntry, t: T, locale: string) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-foreground font-semibold">{a.title || t('untitled')}</p>
        {a.date && (
          <p className="text-muted-foreground text-xs">{formatMonthYear(a.date, locale)}</p>
        )}
      </div>
      {a.issuer && <p className="text-muted-foreground text-sm">{a.issuer}</p>}
      {a.description && (
        <p className="text-foreground/80 mt-1 line-clamp-2 text-sm">{a.description}</p>
      )}
    </div>
  );
}

function editAward(a: AwardEntry, onChange: (next: AwardEntry) => void, t: T) {
  const set = <K extends keyof AwardEntry>(k: K, v: AwardEntry[K]) => onChange({ ...a, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="award-title">{t('fields.title')} *</Label>
        <Input
          id="award-title"
          value={a.title}
          onChange={(ev) => set('title', ev.target.value)}
          required
          placeholder={t('placeholders.title')}
        />
      </div>
      <div>
        <Label htmlFor="award-issuer">{t('fields.issuer')}</Label>
        <Input
          id="award-issuer"
          value={a.issuer ?? ''}
          onChange={(ev) => set('issuer', ev.target.value)}
        />
      </div>
      <MonthYearPicker
        label={t('fields.date')}
        value={a.date ?? ''}
        onChange={(v) => set('date', v)}
      />
      <div className="sm:col-span-2">
        <Label htmlFor="award-desc">{t('fields.description')}</Label>
        <Textarea
          id="award-desc"
          rows={2}
          value={a.description ?? ''}
          onChange={(ev) => set('description', ev.target.value)}
        />
      </div>
    </div>
  );
}
