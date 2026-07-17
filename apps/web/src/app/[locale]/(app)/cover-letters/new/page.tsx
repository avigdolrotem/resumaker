'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Copy, RefreshCw, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelPicker } from '@/components/builder/model-picker';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';
import { apiFetch, ApiTierError } from '@/lib/api-client';

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
  /**
   * Snapshot of the user's profile fetched once on mount. Was previously
   * sent to the generator as `userProfile: {}`, producing letters that
   * referenced neither the user's name nor their skills — generic to the
   * point of useless. We now hydrate it from /api/account/profile.
   */
  const [userProfile, setUserProfile] = useState<Record<string, unknown>>({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/account/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.profile) setUserProfile(data.profile);
      } catch {
        // Non-fatal — fall back to empty profile (degraded letter quality
        // is better than blocking the page on a transient network error).
      }
    })();
  }, []);

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLetter(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/cover-letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jd,
          companyName: company || undefined,
          recipientName: recipient || undefined,
          tone,
          userProfile,
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
      // ApiTierError = 402; the global ApiUpgradeListener already opened
      // the upgrade modal — swallow it here so we don't double-prompt.
      if (err instanceof ApiTierError) return;
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('newTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>
        {/* Same picker as the resume builder — backed by the global
            /api/user/llm-model setting, so the choice persists across both. */}
        <ModelPicker />
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
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
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
          {/* error/empty/loading/result are mutually exclusive — `generate()`
              always clears error+letter before setting loading, so exactly
              one branch below is ever true. AnimatePresence + a per-branch
              key gives the panel a liquid cross-fade instead of an instant
              snap between states, matching the spring recipe in
              upgrade-modal.tsx. */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6 text-red-800">{error}</CardContent>
                </Card>
              </motion.div>
            )}

            {!letter && !loading && !error && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <Card className="border-dashed">
                  <CardContent className="text-muted-foreground py-24 text-center">
                    {t('empty')}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <Card>
                  <CardContent className="py-24 text-center" role="status" aria-live="polite">
                    <LiquidSpinner size={32} className="mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('generating')}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {letter && (
              <motion.div
                key="letter"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                          >
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
                    <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                      {letter}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
