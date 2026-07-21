'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AtsScoreCard } from '@/components/ats-score-card';
import { ResumePreview } from '@/components/resume-preview';
import { ModelPicker } from '@/components/builder/model-picker';
import { apiFetch, ApiTierError } from '@/lib/api-client';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';
import { Save as SaveIcon, Eye, ArrowLeft } from 'lucide-react';
import type { Resume, ATSScore } from '@resumaker/shared';

type LocaleChoice = 'auto' | 'he' | 'en';

/**
 * The shape returned by /api/resumes/generate. `resume` is the canonical
 * {@link Resume} (full schema) — using it directly keeps this component
 * honest: any field present in the schema is available here.
 */
interface ResumeResult {
  resume: Resume;
  jobTitle: string | null;
  companyName: string | null;
  metadata: {
    durationMs: number;
    tokensUsed: { input: number; output: number };
    detectedLocale: string;
  };
}

/**
 * /builder — paste a job description (or link), generate a tailored
 * resume from it.
 *
 * This used to also be where profile data got entered (a "Basic mode"
 * form) and where an existing resume could be hand-edited section by
 * section ("Advanced mode"). Both are gone: profile data now lives
 * once at /career-profile and every generation reads it server-side,
 * and resumes are generated output rather than independently
 * hand-edited documents — there's no more per-resume editor to land
 * in here via `?id=`. Viewing/downloading a saved resume lives at
 * /resumes/[id] instead.
 */
export default function BuilderPage() {
  const t = useTranslations('builder');
  const router = useRouter();

  const [jd, setJd] = useState('');
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<LocaleChoice>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNeedsProfile(false);
    setResult(null);

    // The URL field is `type="url"` for the mobile-keyboard hint, and the
    // form has `noValidate` so a bare domain (no scheme) doesn't silently
    // block submission via the browser's own constraint validation before
    // any of this code runs — that used to mean the whole form (including
    // a validly-filled-in `jd` textarea) just did nothing on submit, no
    // error shown. Normalize instead: a bare domain/path with no scheme
    // is overwhelmingly meant as https, so add it rather than reject it.
    let normalizedUrl = url.trim();
    if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    if (normalizedUrl) {
      try {
        new URL(normalizedUrl);
      } catch {
        setError(t('actions.invalidUrl'));
        return;
      }
    }
    setUrl(normalizedUrl);

    setLoading(true);
    try {
      const body: Record<string, unknown> = { locale };
      if (jd) body.jobDescription = jd;
      if (normalizedUrl) body.jobUrl = normalizedUrl;

      const res = await apiFetch('/api/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NO_PROFILE') {
          setNeedsProfile(true);
        } else {
          setError(data.error ?? t('actions.generateFailed'));
        }
      } else {
        setResult(data);
        setSavedId(null);
        setAtsScore(null);
        const jdForScoring = jd || normalizedUrl;
        if (jdForScoring) {
          void fetchAtsScore(data.resume, jdForScoring);
        }
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

  async function fetchAtsScore(resume: Resume, jobDescription: string, resumeId?: string | null) {
    try {
      const res = await apiFetch('/api/resumes/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jobDescription, ...(resumeId ? { resumeId } : {}) }),
      });
      if (res.ok) {
        const data: ATSScore = await res.json();
        setAtsScore(data);
      }
    } catch {
      // Best-effort, non-blocking auto-score after generation.
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: result.jobTitle,
          companyName: result.companyName,
          content: result.resume,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setSavedId(data.id);
        const jdForScoring = jd || url;
        if (jdForScoring) {
          void fetchAtsScore(result.resume, jdForScoring, data.id);
        }
      } else {
        setError(data.error ?? t('actions.saveFailed'));
      }
    } catch (err) {
      if (err instanceof ApiTierError) return;
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        {/* AI engine picker — hidden for free tier (tier check happens
            inside the component, which fetches /api/user/llm-model). */}
        <ModelPicker />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('jdLabel')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jd">{t('jdLabel')}</Label>
                <Textarea
                  id="jd"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={t('jdPlaceholder')}
                  rows={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">{t('urlLabel')}</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('urlPlaceholder')}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">{t('localeLabel')}</Label>
                <select
                  id="locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as LocaleChoice)}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:ring-brand-500/18 ease-smooth flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  <option value="auto">{t('locales.auto')}</option>
                  <option value="he">{t('locales.he')}</option>
                  <option value="en">{t('locales.en')}</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? t('generating') : t('generate')}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {needsProfile && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-900/20">
              <CardContent className="space-y-3 pt-6 text-amber-900 dark:text-amber-200">
                <p>{t('needsProfile')}</p>
                <Button asChild size="sm">
                  <Link href="/career-profile/onboarding">{t('completeProfile')}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6 text-red-800">{error}</CardContent>
            </Card>
          )}

          {!result && !loading && !error && !needsProfile && (
            <Card className="border-dashed">
              <CardContent className="space-y-2 py-24 text-center">
                <p className="text-foreground text-lg font-medium">{t('empty.title')}</p>
                <p className="text-muted-foreground text-sm">{t('empty.subtitle')}</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-24 text-center">
                <LiquidSpinner size={32} className="mx-auto mb-4" />
                <p className="text-muted-foreground">{t('generating')}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 pt-6">
                  {savedId ? (
                    <>
                      <span className="rounded-full bg-green-50 px-3.5 py-2 text-sm font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300">
                        {t('actions.saved')}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/resumes/${savedId}`}>
                          <Eye className="me-1.5 h-3.5 w-3.5" />
                          {t('viewResume')}
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      <SaveIcon className="me-1.5 h-3.5 w-3.5" />
                      {saving ? t('actions.saving') : t('actions.save')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="me-1.5 h-3.5 w-3.5 rtl:hidden" />
                    {t('actions.backToDashboard')}
                  </Button>
                </CardContent>
              </Card>

              {atsScore && (
                <AtsScoreCard score={atsScore} isHebrew={result.metadata.detectedLocale === 'he'} />
              )}
              <ResumePreview resume={result.resume} metadata={result.metadata} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
