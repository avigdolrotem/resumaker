'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function HrPostJobForm() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.['locale'] === 'he' ? 'he' : 'en') as 'he' | 'en';

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [remote, setRemote] = useState(false);
  const [applyUrl, setApplyUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          company,
          location: location || undefined,
          description,
          remote,
          applyUrl: applyUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? (locale === 'he' ? 'פרסום נכשל' : 'Post failed'));
        return;
      }
      toast.success(locale === 'he' ? 'פורסם' : 'Posted');
      router.push('/hr/jobs');
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
          <CardTitle>{locale === 'he' ? 'פרסם משרה' : 'Post a job'}</CardTitle>
          <CardDescription>
            {locale === 'he'
              ? 'משרה זו תופיע למחפשי עבודה במאגר המשרות הציבורי.'
              : 'This posting will be visible to job-seekers in the public listing.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{locale === 'he' ? 'כותרת המשרה' : 'Job title'}</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{locale === 'he' ? 'שם החברה' : 'Company name'}</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">{locale === 'he' ? 'מיקום' : 'Location'}</Label>
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
                  {locale === 'he' ? 'עבודה מרחוק' : 'Remote'}
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{locale === 'he' ? 'תיאור המשרה' : 'Description'}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                required
                minLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="applyUrl">
                {locale === 'he' ? 'כתובת להגשה (אופציונלי)' : 'Apply URL (optional)'}
              </Label>
              <Input
                id="applyUrl"
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://"
                dir="ltr"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving
                ? locale === 'he'
                  ? 'מפרסם…'
                  : 'Posting…'
                : locale === 'he'
                  ? 'פרסם משרה'
                  : 'Post job'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
