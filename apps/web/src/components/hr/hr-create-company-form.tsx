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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function HrCreateCompanyForm() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.['locale'] === 'he' ? 'he' : 'en') as 'he' | 'en';

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    // Keep the slug in sync with the name until the user edits it
    // directly — the API requires a slug matching ^[a-z0-9-]+$, which
    // isn't a format most people type unprompted.
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/hr/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          websiteUrl: websiteUrl || undefined,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.error ?? (locale === 'he' ? 'יצירת החברה נכשלה' : 'Could not create company'),
        );
        return;
      }
      toast.success(locale === 'he' ? 'החברה נוצרה' : 'Company created');
      router.push(`/hr/company/${data.id}`);
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
          <CardTitle>{locale === 'he' ? 'צור חברה' : 'Create company'}</CardTitle>
          <CardDescription>
            {locale === 'he'
              ? 'תהיה הבעלים של החברה ותוכל להזמין את צוות הגיוס שלך ולפרסם משרות.'
              : "You'll be the owner and can invite your recruiting team and post jobs."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{locale === 'he' ? 'שם החברה' : 'Company name'}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{locale === 'he' ? 'מזהה ייחודי (slug)' : 'Slug'}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                required
                minLength={2}
                maxLength={80}
                pattern="[a-z0-9\-]+"
                dir="ltr"
                placeholder="acme-inc"
              />
              <p className="text-muted-foreground text-xs">
                {locale === 'he'
                  ? 'אותיות לועזיות קטנות, ספרות ומקפים בלבד.'
                  : 'Lowercase letters, numbers, and hyphens only.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">
                {locale === 'he' ? 'אתר החברה (אופציונלי)' : 'Company website (optional)'}
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                {locale === 'he' ? 'תיאור (אופציונלי)' : 'Description (optional)'}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving
                ? locale === 'he'
                  ? 'יוצר…'
                  : 'Creating…'
                : locale === 'he'
                  ? 'צור חברה'
                  : 'Create company'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
