'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiTierError } from '@/lib/api-client';

/**
 * /jobs/paste — manual job import (URL or pasted text).
 *
 * The URL path goes through the @resumaker/job-engine importer which
 * fetches the page and asks Claude haiku to extract structured fields.
 * The text path skips the LLM call and creates a "Pasted job" stub the
 * user can edit in the detail view — cheaper and never hits a paywall.
 */
export default function JobsPastePage() {
  const t = useTranslations('jobs.paste');
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url && !text) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url ? { url } : { text }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        toast.error(data.error ?? t('failed'));
        return;
      }
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      if (err instanceof ApiTierError) return;
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t('urlLabel')}</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('urlPlaceholder')}
                dir="ltr"
                disabled={!!text || loading}
              />
            </div>
            <div className="relative">
              <div className="bg-muted absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
              <span className="bg-card text-muted-foreground relative mx-auto block w-fit px-3 text-xs">
                or
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">{t('textLabel')}</Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('textPlaceholder')}
                rows={10}
                disabled={!!url || loading}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || (!url && !text)}
            >
              <Sparkles className="me-2 h-4 w-4" />
              {loading ? t('importing') : t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
