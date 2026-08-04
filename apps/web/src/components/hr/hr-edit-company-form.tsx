'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface EditableCompany {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  verified: boolean;
}

/**
 * Edit a company's public details.
 *
 * PATCH /api/hr/companies/[id] already accepted all of these; nothing in
 * the interface called it. That made the verified badge unreachable in
 * practice — verification is recomputed from the website URL on update,
 * so a company created with the wrong URL could never become verified,
 * and one created with the right URL could never be corrected if the
 * domain changed.
 *
 * `onSaved` hands the updated row back to the parent rather than
 * triggering a refetch, so the verified badge above updates in the same
 * tick as the save.
 */
export function HrEditCompanyForm({
  company,
  isHe,
  onSaved,
}: {
  company: EditableCompany;
  isHe: boolean;
  onSaved: (updated: EditableCompany) => void;
}) {
  const [name, setName] = useState(company.name);
  const [websiteUrl, setWebsiteUrl] = useState(company.websiteUrl ?? '');
  const [description, setDescription] = useState(company.description ?? '');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/hr/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          // null, not '' — the schema is `.nullable()`, and an empty
          // string would fail the .url() check rather than clearing the
          // field.
          websiteUrl: websiteUrl.trim() || null,
          description: description.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? (isHe ? 'השמירה נכשלה' : 'Save failed'));
        return;
      }
      toast.success(isHe ? 'נשמר' : 'Saved');
      if (data.company) onSaved(data.company as EditableCompany);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isHe ? 'פרטי החברה' : 'Company details'}</CardTitle>
        <CardDescription>
          {isHe
            ? 'הסטטוס "מאומת" מחושב מחדש בכל שמירה, לפי התאמה בין דומיין האתר לדומיין האימייל שלכם.'
            : 'Verified status is recalculated on every save, from whether the website domain matches your email domain.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">{isHe ? 'שם החברה' : 'Company name'}</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-website">{isHe ? 'אתר החברה' : 'Company website'}</Label>
            <Input
              id="company-website"
              type="url"
              dir="ltr"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <p className="text-muted-foreground text-xs">
              {isHe
                ? 'כדי לקבל סימון "מאומת", הדומיין כאן חייב להתאים לדומיין של כתובת האימייל שלכם.'
                : 'To earn the verified badge, this domain must match the domain of your email address.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-description">{isHe ? 'תיאור' : 'Description'}</Label>
            <Textarea
              id="company-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (isHe ? 'שומר…' : 'Saving…') : isHe ? 'שמירת שינויים' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
