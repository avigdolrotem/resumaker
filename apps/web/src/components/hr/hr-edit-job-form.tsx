'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface EditableJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  remote: boolean;
  seniority: string | null;
  status: string;
}

/**
 * Edit an existing posting.
 *
 * PATCH /api/hr/jobs/[id] has always accepted these fields; nothing in
 * the interface reached it, so a recruiter who noticed a typo after
 * publishing had no way to correct it. QA put it plainly: you could post
 * but never fix.
 *
 * Deliberately a separate component from HrPostJobForm rather than a
 * dual-mode refactor of it. The create flow works and is the one that
 * matters most; bending it around an `initial` prop risks breaking the
 * path that already earns money to save duplicating a form layout.
 *
 * The company is shown read-only. PATCH takes `company` as a display
 * string while the row also carries companySlug and companyId, so
 * editing the name here would desync three columns that are supposed to
 * agree. Moving a posting between companies is a different operation
 * than fixing its text, and it isn't one this endpoint models.
 */
export function HrEditJobForm({ job }: { job: EditableJob }) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.['locale'] === 'he' ? 'he' : 'en') as 'he' | 'en';
  const isHe = locale === 'he';

  const [title, setTitle] = useState(job.title);
  const [location, setLocation] = useState(job.location ?? '');
  const [description, setDescription] = useState(job.description);
  const [remote, setRemote] = useState(job.remote);
  const [seniority, setSeniority] = useState(job.seniority ?? '');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/hr/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          location,
          description,
          remote,
          // Empty means "not specified" — send undefined rather than an
          // empty string so the field is left alone instead of being
          // overwritten with blank.
          ...(seniority ? { seniority } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? (isHe ? 'השמירה נכשלה' : 'Save failed'));
        return;
      }
      toast.success(isHe ? 'נשמר' : 'Saved');
      router.push('/hr/jobs');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{isHe ? 'עריכת משרה' : 'Edit listing'}</CardTitle>
          <CardDescription>
            {job.status === 'open'
              ? isHe
                ? 'המשרה מפורסמת כעת. שינויים ייכנסו לתוקף מיד.'
                : 'This listing is live. Changes take effect immediately.'
              : isHe
                ? 'המשרה סגורה. אפשר לערוך אותה ולפתוח אותה מחדש מרשימת המשרות.'
                : 'This listing is closed. You can edit it and reopen it from your jobs list.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{isHe ? 'כותרת המשרה' : 'Job title'}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{isHe ? 'חברה' : 'Company'}</Label>
              <p className="text-muted-foreground border-input bg-muted/40 rounded-md border px-3 py-2 text-sm">
                {job.company}
              </p>
              <p className="text-muted-foreground text-xs">
                {isHe
                  ? 'לא ניתן להעביר משרה קיימת לחברה אחרת. פרסמו משרה חדשה תחת החברה הנכונה.'
                  : "A posting can't be moved to a different company. Post a new one under the right company instead."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">{isHe ? 'מיקום' : 'Location'}</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                    className="accent-brand-600 h-4 w-4 rounded"
                  />
                  {isHe ? 'עבודה מרחוק' : 'Remote'}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniority">
                {isHe ? 'רמת ותק (אופציונלי)' : 'Seniority (optional)'}
              </Label>
              <Input
                id="seniority"
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
                placeholder={isHe ? 'למשל: בכיר/ה' : 'e.g. Senior'}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{isHe ? 'תיאור המשרה' : 'Description'}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={12}
                required
                minLength={50}
              />
              {/* The 50-character minimum is enforced server-side and was
                  previously invisible until submission failed with a bare
                  "Invalid body". */}
              <p className="text-muted-foreground text-xs">
                {isHe
                  ? `${description.length} תווים — נדרשים לפחות 50`
                  : `${description.length} characters — 50 required`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving || description.length < 50}>
                {saving ? (isHe ? 'שומר…' : 'Saving…') : isHe ? 'שמירת שינויים' : 'Save changes'}
              </Button>
              <Button asChild variant="ghost" type="button">
                <Link href="/hr/jobs">{isHe ? 'ביטול' : 'Cancel'}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
