'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, RefreshCw, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Tone = 'formal' | 'friendly' | 'enthusiastic';

export default function NewCoverLetterPage() {
  const t = useTranslations('coverLetter');
  const [jd, setJd] = useState('');
  const [company, setCompany] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tone, setTone] = useState<Tone>('formal');
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detectedLocale, setDetectedLocale] = useState<'he' | 'en'>('en');

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLetter(null);
    setLoading(true);
    try {
      const res = await fetch('/api/cover-letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jd,
          companyName: company || undefined,
          recipientName: recipient || undefined,
          tone,
          userProfile: {},
          locale: 'auto',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Generation failed');
      } else {
        setLetter(data.letter);
        setDetectedLocale(data.metadata?.detectedLocale ?? 'en');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!letter) return;
    setSaving(true);
    try {
      const title = company
        ? `Cover letter — ${company}`
        : `Cover letter ${new Date().toLocaleDateString()}`;
      const res = await fetch('/api/cover-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: letter,
          jobDescription: jd,
          companyName: company || undefined,
          recipientName: recipient || undefined,
          tone,
          locale: detectedLocale,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        toast.success('Saved');
        setSavedId(data.id);
      } else {
        toast.error(data.error ?? 'Save failed');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    toast.success(t('copied'));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('newTitle')}</h1>
        <p className="mt-2 text-neutral-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={generate} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('jdLabel')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={t('jdPlaceholder')}
                rows={10}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">{t('companyLabel')}</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient">{t('recipientLabel')}</Label>
                  <Input
                    id="recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">{t('toneLabel')}</Label>
                <select
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="focus-visible:ring-brand-500 flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  <option value="formal">{t('tones.formal')}</option>
                  <option value="friendly">{t('tones.friendly')}</option>
                  <option value="enthusiastic">{t('tones.enthusiastic')}</option>
                </select>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || !jd}>
                <Sparkles className="me-2 h-4 w-4" />
                {loading ? t('generating') : t('generate')}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6 text-red-800">{error}</CardContent>
            </Card>
          )}

          {!letter && !loading && !error && (
            <Card className="border-dashed">
              <CardContent className="py-24 text-center text-neutral-500">{t('empty')}</CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-24 text-center" role="status" aria-live="polite">
                <div className="border-brand-200 border-t-brand-600 mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2" />
                <p className="text-neutral-600">{t('generating')}</p>
              </CardContent>
            </Card>
          )}

          {letter && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{t('title')}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                      <Copy className="me-1 h-4 w-4" />
                      {t('copy')}
                    </Button>
                    {!savedId && (
                      <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                        <Save className="me-1 h-4 w-4" />
                        {saving ? '…' : 'Save'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLetter(null);
                        setSavedId(null);
                        void generate({
                          preventDefault: () => {},
                        } as React.FormEvent<HTMLFormElement>);
                      }}
                    >
                      <RefreshCw className="me-1 h-4 w-4" />
                      {t('regenerate')}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                  {letter}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
