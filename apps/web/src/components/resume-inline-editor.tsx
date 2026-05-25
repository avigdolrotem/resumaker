'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ResumeContent {
  metadata: { language: 'he' | 'en'; generated_at: string; template: string };
  contact: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    highlights?: string[];
  }>;
  education: Array<{ institution: string; degree: string; start_date?: string; end_date?: string }>;
  skills: string[];
  languages?: Array<{ name: string; level: string }>;
  certifications?: Array<{ name: string; issuer: string; date?: string; url?: string }>;
  projects?: Array<{ name: string; description: string; url?: string }>;
  awards?: Array<{ title: string; issuer: string; date?: string }>;
  volunteering?: Array<{ role: string; organization: string; description?: string }>;
  references?: Array<{ name: string; relation: string; contact?: string }>;
}

interface Props {
  resumeId: string;
  initialContent: ResumeContent;
  isHebrew: boolean;
  onSaved?: () => void;
}

/**
 * Full inline editor — every field click-to-edit, sections reorderable
 * with ↑/↓ buttons (no drag-drop dependency), custom rows addable
 * everywhere. Save persists via PATCH /api/resumes/[id] (which
 * snapshots a version row first).
 *
 * Why ↑/↓ instead of drag-and-drop: keyboard-accessible by default,
 * works on touch, zero extra dependencies. Drag is nice but adds
 * @dnd-kit + a11y burden.
 */
export function ResumeInlineEditor({ resumeId, initialContent, isHebrew, onSaved }: Props) {
  const [content, setContent] = useState<ResumeContent>(initialContent);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setContent((p) => ({ ...p, [key]: value }));
  }

  function updateContact<K extends keyof ResumeContent['contact']>(
    key: K,
    value: ResumeContent['contact'][K],
  ) {
    setContent((p) => ({ ...p, contact: { ...p.contact, [key]: value } }));
  }

  function moveItem<T>(arr: T[], from: number, dir: -1 | 1): T[] {
    const to = from + dir;
    if (to < 0 || to >= arr.length) return arr;
    const next = arr.slice();
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? (isHebrew ? 'שמירה נכשלה' : 'Save failed'));
        return;
      }
      toast.success(isHebrew ? 'נשמר' : 'Saved');
      onSaved?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-border bg-background/95 sticky top-0 z-10 -mx-4 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <h2 className="text-lg font-semibold">{isHebrew ? 'עריכת קורות חיים' : 'Edit resume'}</h2>
        <Button onClick={save} disabled={saving} size="sm">
          <Save className="me-2 h-4 w-4" />
          {saving ? (isHebrew ? 'שומר…' : 'Saving…') : isHebrew ? 'שמור' : 'Save'}
        </Button>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isHebrew ? 'פרטי קשר' : 'Contact'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field
            label={isHebrew ? 'שם' : 'Name'}
            value={content.contact.name}
            onChange={(v) => updateContact('name', v)}
          />
          <Field
            label={isHebrew ? 'אימייל' : 'Email'}
            value={content.contact.email ?? ''}
            onChange={(v) => updateContact('email', v)}
            dir="ltr"
          />
          <Field
            label={isHebrew ? 'טלפון' : 'Phone'}
            value={content.contact.phone ?? ''}
            onChange={(v) => updateContact('phone', v)}
            dir="ltr"
          />
          <Field
            label={isHebrew ? 'מיקום' : 'Location'}
            value={content.contact.location ?? ''}
            onChange={(v) => updateContact('location', v)}
          />
          <Field
            label="LinkedIn"
            value={content.contact.linkedin ?? ''}
            onChange={(v) => updateContact('linkedin', v)}
            dir="ltr"
          />
          <Field
            label={isHebrew ? 'אתר' : 'Website'}
            value={content.contact.website ?? ''}
            onChange={(v) => updateContact('website', v)}
            dir="ltr"
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isHebrew ? 'תקציר' : 'Summary'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={content.summary}
            onChange={(e) => update('summary', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Experience */}
      <ListSection
        title={isHebrew ? 'ניסיון תעסוקתי' : 'Experience'}
        isHebrew={isHebrew}
        items={content.experience}
        onChange={(items) => update('experience', items)}
        moveItem={moveItem}
        emptyItem={() => ({
          company: '',
          title: '',
          start_date: '',
          end_date: null,
          highlights: [],
        })}
        renderItem={(item, onItemChange) => (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label={isHebrew ? 'תפקיד' : 'Title'}
                value={item.title}
                onChange={(v) => onItemChange({ ...item, title: v })}
              />
              <Field
                label={isHebrew ? 'חברה' : 'Company'}
                value={item.company}
                onChange={(v) => onItemChange({ ...item, company: v })}
              />
              <Field
                label={isHebrew ? 'תאריך התחלה' : 'Start date'}
                value={item.start_date}
                onChange={(v) => onItemChange({ ...item, start_date: v })}
                dir="ltr"
              />
              <Field
                label={isHebrew ? 'תאריך סיום (ריק = כעת)' : 'End date (blank = present)'}
                value={item.end_date ?? ''}
                onChange={(v) => onItemChange({ ...item, end_date: v || null })}
                dir="ltr"
              />
            </div>
            <StringArrayEditor
              label={isHebrew ? 'הישגים' : 'Highlights'}
              values={item.highlights ?? []}
              onChange={(arr) => onItemChange({ ...item, highlights: arr })}
              placeholder={isHebrew ? 'הוסף הישג' : 'Add a highlight'}
            />
          </div>
        )}
      />

      {/* Education */}
      <ListSection
        title={isHebrew ? 'השכלה' : 'Education'}
        isHebrew={isHebrew}
        items={content.education}
        onChange={(items) => update('education', items)}
        moveItem={moveItem}
        emptyItem={() => ({ institution: '', degree: '', start_date: '', end_date: '' })}
        renderItem={(item, onItemChange) => (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label={isHebrew ? 'תואר' : 'Degree'}
              value={item.degree}
              onChange={(v) => onItemChange({ ...item, degree: v })}
            />
            <Field
              label={isHebrew ? 'מוסד' : 'Institution'}
              value={item.institution}
              onChange={(v) => onItemChange({ ...item, institution: v })}
            />
            <Field
              label={isHebrew ? 'תאריך התחלה' : 'Start'}
              value={item.start_date ?? ''}
              onChange={(v) => onItemChange({ ...item, start_date: v })}
              dir="ltr"
            />
            <Field
              label={isHebrew ? 'תאריך סיום' : 'End'}
              value={item.end_date ?? ''}
              onChange={(v) => onItemChange({ ...item, end_date: v })}
              dir="ltr"
            />
          </div>
        )}
      />

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isHebrew ? 'כישורים' : 'Skills'}</CardTitle>
        </CardHeader>
        <CardContent>
          <StringArrayEditor
            label=""
            values={content.skills}
            onChange={(arr) => update('skills', arr)}
            placeholder={isHebrew ? 'הוסף כישור' : 'Add a skill'}
          />
        </CardContent>
      </Card>

      {/* Languages */}
      <ListSection
        title={isHebrew ? 'שפות' : 'Languages'}
        isHebrew={isHebrew}
        items={content.languages ?? []}
        onChange={(items) => update('languages', items)}
        moveItem={moveItem}
        emptyItem={() => ({ name: '', level: '' })}
        renderItem={(item, onItemChange) => (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label={isHebrew ? 'שפה' : 'Language'}
              value={item.name}
              onChange={(v) => onItemChange({ ...item, name: v })}
            />
            <Field
              label={isHebrew ? 'רמה' : 'Level'}
              value={item.level}
              onChange={(v) => onItemChange({ ...item, level: v })}
            />
          </div>
        )}
      />

      {/* Certifications */}
      <ListSection
        title={isHebrew ? 'תעודות' : 'Certifications'}
        isHebrew={isHebrew}
        items={content.certifications ?? []}
        onChange={(items) => update('certifications', items)}
        moveItem={moveItem}
        emptyItem={() => ({ name: '', issuer: '', date: '', url: '' })}
        renderItem={(item, onItemChange) => (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label={isHebrew ? 'תעודה' : 'Name'}
              value={item.name}
              onChange={(v) => onItemChange({ ...item, name: v })}
            />
            <Field
              label={isHebrew ? 'מנפיק' : 'Issuer'}
              value={item.issuer}
              onChange={(v) => onItemChange({ ...item, issuer: v })}
            />
            <Field
              label={isHebrew ? 'תאריך' : 'Date'}
              value={item.date ?? ''}
              onChange={(v) => onItemChange({ ...item, date: v })}
              dir="ltr"
            />
            <Field
              label="URL"
              value={item.url ?? ''}
              onChange={(v) => onItemChange({ ...item, url: v })}
              dir="ltr"
            />
          </div>
        )}
      />

      {/* Projects */}
      <ListSection
        title={isHebrew ? 'פרויקטים' : 'Projects'}
        isHebrew={isHebrew}
        items={content.projects ?? []}
        onChange={(items) => update('projects', items)}
        moveItem={moveItem}
        emptyItem={() => ({ name: '', description: '', url: '' })}
        renderItem={(item, onItemChange) => (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label={isHebrew ? 'שם' : 'Name'}
                value={item.name}
                onChange={(v) => onItemChange({ ...item, name: v })}
              />
              <Field
                label="URL"
                value={item.url ?? ''}
                onChange={(v) => onItemChange({ ...item, url: v })}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{isHebrew ? 'תיאור' : 'Description'}</Label>
              <Textarea
                value={item.description}
                onChange={(e) => onItemChange({ ...item, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}
      />

      {/* Awards */}
      <ListSection
        title={isHebrew ? 'פרסים' : 'Awards'}
        isHebrew={isHebrew}
        items={content.awards ?? []}
        onChange={(items) => update('awards', items)}
        moveItem={moveItem}
        emptyItem={() => ({ title: '', issuer: '', date: '' })}
        renderItem={(item, onItemChange) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Field
              label={isHebrew ? 'פרס' : 'Title'}
              value={item.title}
              onChange={(v) => onItemChange({ ...item, title: v })}
            />
            <Field
              label={isHebrew ? 'מעניק' : 'Issuer'}
              value={item.issuer}
              onChange={(v) => onItemChange({ ...item, issuer: v })}
            />
            <Field
              label={isHebrew ? 'תאריך' : 'Date'}
              value={item.date ?? ''}
              onChange={(v) => onItemChange({ ...item, date: v })}
              dir="ltr"
            />
          </div>
        )}
      />

      {/* Volunteering */}
      <ListSection
        title={isHebrew ? 'התנדבות' : 'Volunteering'}
        isHebrew={isHebrew}
        items={content.volunteering ?? []}
        onChange={(items) => update('volunteering', items)}
        moveItem={moveItem}
        emptyItem={() => ({ role: '', organization: '', description: '' })}
        renderItem={(item, onItemChange) => (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label={isHebrew ? 'תפקיד' : 'Role'}
                value={item.role}
                onChange={(v) => onItemChange({ ...item, role: v })}
              />
              <Field
                label={isHebrew ? 'ארגון' : 'Organization'}
                value={item.organization}
                onChange={(v) => onItemChange({ ...item, organization: v })}
              />
            </div>
            <Textarea
              value={item.description ?? ''}
              onChange={(e) => onItemChange({ ...item, description: e.target.value })}
              rows={2}
              placeholder={isHebrew ? 'תיאור (אופציונלי)' : 'Description (optional)'}
            />
          </div>
        )}
      />

      <div className="flex justify-end pb-12">
        <Button onClick={save} disabled={saving} size="lg">
          <Save className="me-2 h-4 w-4" />
          {saving ? (isHebrew ? 'שומר…' : 'Saving…') : isHebrew ? 'שמור הכל' : 'Save all'}
        </Button>
      </div>
    </div>
  );
}

// ─── Generic field + array + list section ───────────────────────────

function Field({
  label,
  value,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...(dir ? { dir } : {})} />
    </div>
  );
}

function StringArrayEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (arr: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <ul className="space-y-1">
        {values.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) => {
                const next = values.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ''])}>
        <Plus className="me-1 h-3.5 w-3.5" />
        {placeholder}
      </Button>
    </div>
  );
}

function ListSection<T>({
  title,
  isHebrew,
  items,
  onChange,
  moveItem,
  emptyItem,
  renderItem,
}: {
  title: string;
  isHebrew: boolean;
  items: T[];
  onChange: (items: T[]) => void;
  moveItem: <U>(arr: U[], from: number, dir: -1 | 1) => U[];
  emptyItem: () => T;
  renderItem: (item: T, onChange: (next: T) => void) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {isHebrew ? 'אין פריטים בקטע זה.' : 'No items yet.'}
          </p>
        )}
        {items.map((item, i) => (
          <div key={i} className="border-border rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <GripVertical className="h-3.5 w-3.5" />#{i + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={i === 0}
                  onClick={() => onChange(moveItem(items, i, -1))}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={i === items.length - 1}
                  onClick={() => onChange(moveItem(items, i, 1))}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label={isHebrew ? 'הסר' : 'Remove'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {renderItem(item, (next) => {
              const arr = items.slice();
              arr[i] = next;
              onChange(arr);
            })}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, emptyItem()])}
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          {isHebrew ? 'הוסף' : 'Add'}
        </Button>
      </CardContent>
    </Card>
  );
}
