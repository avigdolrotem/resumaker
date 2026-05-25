'use client';

import { FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';

/** Summary card — single SectionCard with a textarea. */

export interface SummaryCardProps {
  summary: string;
  onChange: (next: string) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const CARD_ID = 'summary';

export function SummaryCard({ summary, onChange, editingId, onSetEditingId }: SummaryCardProps) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <FileText className="text-brand-500 h-4 w-4" />
          Summary
        </h2>
      </header>
      <SectionCard
        data={summary}
        isEditing={editingId === CARD_ID}
        onEnterEdit={() => onSetEditingId(CARD_ID)}
        onSave={(next) => {
          onChange(next);
          onSetEditingId(null);
        }}
        onCancel={() => onSetEditingId(null)}
        onDelete={() => {
          onChange('');
          onSetEditingId(null);
        }}
        renderRead={readSummary}
        renderEdit={editSummary}
        deleteConfirmText="Clear the summary?"
      />
    </section>
  );
}

function readSummary(s: string) {
  if (!s.trim()) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No summary yet. Click to write one — 2-4 sentences describing your strengths.
      </p>
    );
  }
  return <p className="text-foreground/90 line-clamp-4 text-sm leading-relaxed">{s}</p>;
}

function editSummary(s: string, onChange: (next: string) => void) {
  return (
    <div>
      <Label htmlFor="summary-text" className="sr-only">
        Summary
      </Label>
      <Textarea
        id="summary-text"
        rows={5}
        value={s}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder="A brief professional summary — 2-4 sentences describing your strengths, focus, and what you're looking for."
        maxLength={2000}
      />
      <p className="text-muted-foreground mt-1 text-xs">{s.length} / 2000 characters</p>
    </div>
  );
}
