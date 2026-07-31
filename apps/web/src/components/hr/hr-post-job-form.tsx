'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CompanyOption {
  id: string;
  name: string;
  verified: boolean;
}

export function HrPostJobForm() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.['locale'] === 'he' ? 'he' : 'en') as 'he' | 'en';

  const [companies, setCompanies] = useState<CompanyOption[] | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [remote, setRemote] = useState(false);
  const [applyUrl, setApplyUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Posting requires an actual companies row now (see the route's own
  // comment — companyId used to never get set at all), so the form
  // needs to know which companies this HR user can post as before it
  // can render anything.
  useEffect(() => {
    fetch('/api/hr/companies')
      .then((res) => res.json())
      .then((data: { companies?: CompanyOption[] }) => {
        const list = data.companies ?? [];
        setCompanies(list);
        if (list.length > 0 && list[0]) setCompanyId(list[0].id);
      })
      .catch(() => setCompanies([]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title,
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

  if (companies !== null && companies.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{locale === 'he' ? 'פרסם משרה' : 'Post a job'}</CardTitle>
            <CardDescription>
              {locale === 'he'
                ? 'צריך קודם ליצור חברה כדי לפרסם משרה תחתיה.'
                : "You'll need to create a company before you can post a job under it."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/hr/company/new">
                {locale === 'he' ? 'צור חברה' : 'Create a company'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
              <Label htmlFor="company">{locale === 'he' ? 'חברה' : 'Company'}</Label>
              <select
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {(companies ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.verified ? ` — ${locale === 'he' ? 'מאומת' : 'verified'}` : ''}
                  </option>
                ))}
              </select>
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
            <Button type="submit" size="lg" className="w-full" disabled={saving || !companyId}>
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
