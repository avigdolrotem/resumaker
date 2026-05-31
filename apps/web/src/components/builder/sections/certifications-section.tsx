'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Resume } from '@resumaker/shared';
import { Award, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';
import { SortableList } from '../sortable-list';
import { MonthYearPicker, formatMonthYear } from '../month-year-picker';

type T = ReturnType<typeof useTranslations>;

/** Certifications section — list of cards with single date + credential URL. */

type Certification = NonNullable<Resume['certifications']>[number];

export interface CertificationsSectionProps {
  entries: Certification[];
  onChange: (entries: Certification[]) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const EMPTY: Certification = {
  name: '',
  issuer: '',
  date: '',
  credential_url: undefined,
};

export function CertificationsSection({
  entries,
  onChange,
  editingId,
  onSetEditingId,
}: CertificationsSectionProps) {
  const t = useTranslations('builder.sections.certifications');
  const locale = useLocale();
  const [pendingNew, setPendingNew] = useState<Certification | null>(null);
  const newCardId = 'new:certification';

  function handleAdd() {
    setPendingNew({ ...EMPTY });
    onSetEditingId(newCardId);
  }

  function handleSaveExisting(i: number, next: Certification) {
    const copy = [...entries];
    copy[i] = next;
    onChange(copy);
    onSetEditingId(null);
  }

  function handleSaveNew(next: Certification) {
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
          <Award className="text-brand-500 h-4 w-4" />
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
          renderRead={(d) => readCertification(d, t, locale)}
          renderEdit={(d, onChangeDraft) => editCertification(d, onChangeDraft, t)}
        />
      )}

      {entries.length === 0 && !pendingNew && (
        <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        </div>
      )}

      <SortableList items={entries} sectionKey="certification" onReorder={onChange}>
        {(c, i, dragHandle) => (
          <SectionCard
            data={c}
            isEditing={editingId === `certification:${i}`}
            onEnterEdit={() => onSetEditingId(`certification:${i}`)}
            onSave={(next) => handleSaveExisting(i, next)}
            onCancel={() => onSetEditingId(null)}
            onDelete={() => handleDelete(i)}
            renderRead={(d) => readCertification(d, t, locale)}
            renderEdit={(d, onChangeDraft) => editCertification(d, onChangeDraft, t)}
            deleteConfirmText={t('deleteConfirm', { name: c.name || t('deleteFallback') })}
            leading={dragHandle}
          />
        )}
      </SortableList>
    </section>
  );
}

function readCertification(c: Certification, t: T, locale: string) {
  return (
    <div>
      <p className="text-foreground font-semibold">{c.name || t('untitled')}</p>
      {(c.issuer || c.date) && (
        <p className="text-muted-foreground text-sm">
          {c.issuer}
          {c.issuer && c.date && ' · '}
          {c.date && formatMonthYear(c.date, locale)}
        </p>
      )}
      {c.credential_url && (
        <a
          href={c.credential_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-brand-600 hover:text-brand-700 mt-1 inline-block text-xs underline"
        >
          {t('viewCredential')}
        </a>
      )}
    </div>
  );
}

function editCertification(c: Certification, onChange: (next: Certification) => void, t: T) {
  const set = <K extends keyof Certification>(k: K, v: Certification[K]) =>
    onChange({ ...c, [k]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="cert-name">{t('fields.name')} *</Label>
        <Input
          id="cert-name"
          value={c.name}
          onChange={(ev) => set('name', ev.target.value)}
          required
          placeholder={t('placeholders.name')}
        />
      </div>
      <div>
        <Label htmlFor="cert-issuer">{t('fields.issuer')}</Label>
        <Input
          id="cert-issuer"
          value={c.issuer ?? ''}
          onChange={(ev) => set('issuer', ev.target.value)}
          placeholder={t('placeholders.issuer')}
        />
      </div>
      <MonthYearPicker
        label={t('fields.issued')}
        value={c.date ?? ''}
        onChange={(v) => set('date', v)}
      />
      <div className="sm:col-span-2">
        <Label htmlFor="cert-url">{t('fields.credentialUrl')}</Label>
        <Input
          id="cert-url"
          type="url"
          value={c.credential_url ?? ''}
          onChange={(ev) => set('credential_url', ev.target.value || undefined)}
          placeholder={t('placeholders.credentialUrl')}
        />
      </div>
    </div>
  );
}
