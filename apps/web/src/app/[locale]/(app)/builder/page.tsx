'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportProfileButton } from '@/components/import-profile-button';
import { AtsScoreCard } from '@/components/ats-score-card';
import { ResumePreview } from '@/components/resume-preview';
import { VersionHistory } from '@/components/version-history';
import { TemplatePicker, type TemplateId } from '@/components/template-picker';
import type { Tier } from '@/lib/billing/limits';

type Industry = 'tech' | 'healthcare' | 'finance' | 'general';
type LocaleChoice = 'auto' | 'he' | 'en';

interface ResumeResult {
  resume: {
    metadata: { language: 'he' | 'en'; generated_at: string; template: string };
    contact: { name: string; email?: string };
    summary: string;
    experience: Array<{
      company: string;
      title: string;
      start_date: string;
      end_date: string | null;
      highlights?: string[];
    }>;
    education: Array<{ institution: string; degree: string }>;
    skills: string[];
  };
  metadata: {
    durationMs: number;
    tokensUsed: { input: number; output: number };
    detectedLocale: 'he' | 'en';
  };
}

interface ATSScore {
  overall: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: Array<{ type: string; severity: string; message: string }>;
}

export default function BuilderPage() {
  const t = useTranslations('builder');
  const search = useSearchParams();
  /**
   * Edit-mode: when `/builder?id=<uuid>` we hydrate state from an existing
   * resume. Save then PATCHes instead of POSTing. This was the missing
   * piece behind the "dashboard cards open a blank builder" launch
   * blocker — the route accepted the query param but the page ignored it.
   */
  const editingId = search.get('id');

  const [jd, setJd] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [profileSummary, setProfileSummary] = useState('');
  const [profileSkills, setProfileSkills] = useState('');
  const [experienceText, setExperienceText] = useState('');
  const [industry, setIndustry] = useState<Industry>('tech');
  const [locale, setLocale] = useState<LocaleChoice>('auto');
  const [templateId, setTemplateId] = useState<TemplateId>('modern');
  const [userTier, setUserTier] = useState<Tier>('free');
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(Boolean(editingId));
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(editingId);
  const [saving, setSaving] = useState(false);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const router = useRouter();

  // Fetch the user's tier once so the template picker can show locks for
  // templates above their plan. Defaults to 'free' until the response is in
  // (always-safe default — worst case shows a lock that disappears later).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/billing/me');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.tier) setUserTier(data.tier);
      } catch {
        /* keep 'free' fallback */
      }
    })();
  }, []);

  /**
   * Hydrate from existing resume when `?id` is present. Runs once per id
   * change so deep-linking between two saved resumes also works.
   */
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/resumes/${editingId}`);
        if (!res.ok) {
          if (!cancelled) {
            setError(t('actions.loadFailed'));
            setHydrating(false);
          }
          return;
        }
        const { resume } = await res.json();
        if (cancelled || !resume?.content) return;
        const c = resume.content as ResumeResult['resume'];
        setName(c.contact?.name ?? '');
        setEmail(c.contact?.email ?? '');
        setProfileSummary(c.summary ?? '');
        setProfileSkills((c.skills ?? []).join(', '));
        setIndustry((resume.industry ?? 'tech') as Industry);
        setLocale((c.metadata?.language ?? 'auto') as LocaleChoice);
        if (resume.templateId) setTemplateId(resume.templateId as TemplateId);
        setResult({
          resume: c,
          metadata: {
            durationMs: 0,
            tokensUsed: { input: 0, output: 0 },
            detectedLocale: c.metadata?.language ?? 'en',
          },
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const userProfile = {
        name,
        email,
        phone,
        location,
        linkedin,
        summary: profileSummary,
        skills: profileSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        // experienceText is free-form. We pass it as description on a
        // placeholder entry; the LLM extracts structure from it. We do NOT
        // hardcode company/title (was a bug — produced "Role at Current").
        experience: experienceText ? [{ description: experienceText }] : [],
      };

      const body: Record<string, unknown> = {
        userProfile,
        locale,
        industry,
      };
      if (jd) body.jobDescription = jd;
      if (url) body.jobUrl = url;

      const res = await fetch('/api/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('actions.generateFailed'));
      } else {
        setResult(data);
        setSavedId(null);
        setAtsScore(null);
        // Auto-trigger ATS scoring. Previously this was gated on `if (jd)`
        // — meaning users who submitted via URL got no score at all. The
        // generator returns a sanitized `metadata.detectedLocale` and the
        // sanitized text isn't exposed, so we fall back to the URL string
        // as the "JD" the scorer compares against. Better than nothing.
        const jdForScoring = jd || url;
        if (jdForScoring) {
          void fetchAtsScore(data.resume, jdForScoring);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAtsScore(resume: ResumeResult['resume'], jobDescription: string) {
    try {
      const res = await fetch('/api/resumes/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jobDescription }),
      });
      if (res.ok) {
        const data: ATSScore = await res.json();
        setAtsScore(data);
      }
    } catch {
      /* non-blocking; score is best-effort */
    }
  }

  function applyImportedProfile(p: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    summary?: string;
    skills?: string[];
    experience?: Array<{
      company?: string;
      title?: string;
      description?: string;
      highlights?: string[];
    }>;
  }) {
    if (p.name) setName(p.name);
    if (p.email) setEmail(p.email);
    if (p.phone) setPhone(p.phone);
    if (p.location) setLocation(p.location);
    if (p.linkedin) setLinkedin(p.linkedin);
    if (p.summary) setProfileSummary(p.summary);
    if (p.skills?.length) setProfileSkills(p.skills.join(', '));
    if (p.experience?.length) {
      const exp = p.experience[0];
      const lines: string[] = [];
      if (exp?.title && exp?.company) lines.push(`${exp.title} at ${exp.company}`);
      if (exp?.description) lines.push(exp.description);
      if (exp?.highlights?.length) lines.push(...exp.highlights);
      setExperienceText(lines.join('\n'));
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      // Editing an existing resume → PATCH (records a new version).
      // Brand-new resume → POST (tier-gated insert).
      const isEditing = Boolean(editingId);
      const title = name
        ? t('actions.titleFormat', { name, industry })
        : t('actions.titleFallback', { date: new Date().toLocaleDateString() });
      const res = await fetch(isEditing ? `/api/resumes/${editingId}` : '/api/resumes', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing
            ? { title, content: result.resume }
            : { title, content: result.resume, templateId },
        ),
      });
      const data = await res.json();
      if (res.ok) {
        // POST returns { id }; PATCH returns { success: true }. Keep
        // savedId = editingId in the PATCH case so subsequent saves
        // continue to update the same row.
        if (data.id) setSavedId(data.id);
        else if (isEditing && editingId) setSavedId(editingId);
      } else {
        setError(data.error ?? t('actions.saveFailed'));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  rows={8}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{t('profileTitle')}</span>
                <ImportProfileButton onImport={applyImportedProfile} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('form.name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('form.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('form.phone')}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">{t('form.location')}</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="linkedin">{t('form.linkedin')}</Label>
                  <Input
                    id="linkedin"
                    type="url"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">{t('form.summary')}</Label>
                <Textarea
                  id="summary"
                  value={profileSummary}
                  onChange={(e) => setProfileSummary(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">{t('form.skills')}</Label>
                <Input
                  id="skills"
                  value={profileSkills}
                  onChange={(e) => setProfileSkills(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">{t('form.experience')}</Label>
                <Textarea
                  id="experience"
                  value={experienceText}
                  onChange={(e) => setExperienceText(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry">{t('industryLabel')}</Label>
                  <select
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value as Industry)}
                    className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="tech">{t('industries.tech')}</option>
                    <option value="healthcare">{t('industries.healthcare')}</option>
                    <option value="finance">{t('industries.finance')}</option>
                    <option value="general">{t('industries.general')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">{t('localeLabel')}</Label>
                  <select
                    id="locale"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as LocaleChoice)}
                    className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="auto">{t('locales.auto')}</option>
                    <option value="he">{t('locales.he')}</option>
                    <option value="en">{t('locales.en')}</option>
                  </select>
                </div>
              </div>
              {/* Template picker — moved here so users see it before they
                  hit Generate. Locked templates show a lock icon for free
                  tier; clicking Generate uses whatever's selected, and
                  Save persists it. Was hardcoded 'modern' before — Plus
                  + Pro users got no visual benefit from their plan. */}
              <div className="mt-6 space-y-2">
                <Label>{locale === 'he' || jd.match(/[֐-׿]/) ? 'תבנית' : 'Template'}</Label>
                <TemplatePicker value={templateId} onChange={setTemplateId} userTier={userTier} />
              </div>

              <Button type="submit" disabled={loading} size="lg" className="mt-6 w-full">
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

          {hydrating && !result && (
            <Card>
              <CardContent className="py-24 text-center">
                <div className="border-brand-200 border-t-brand-600 mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2" />
                <p className="text-neutral-600">
                  {t.has('actions.loadingExisting') ? t('actions.loadingExisting') : 'Loading…'}
                </p>
              </CardContent>
            </Card>
          )}

          {!result && !loading && !error && !hydrating && (
            <Card className="border-dashed">
              <CardContent className="space-y-2 py-24 text-center">
                <p className="text-lg font-medium text-neutral-700">{t('empty.title')}</p>
                <p className="text-sm text-neutral-500">{t('empty.subtitle')}</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-24 text-center">
                <div className="border-brand-200 border-t-brand-600 mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2" />
                <p className="text-neutral-600">{t('generating')}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              {/* Action bar */}
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 pt-6">
                  {savedId ? (
                    <span className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                      {t('actions.saved')}
                    </span>
                  ) : (
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      {saving ? t('actions.saving') : t('actions.save')}
                    </Button>
                  )}
                  {savedId && (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/resumes/${savedId}/pdf`} target="_blank" rel="noreferrer">
                          {t('downloadPdf')}
                        </a>
                      </Button>
                      <VersionHistory
                        resumeId={savedId}
                        isHebrew={result.metadata.detectedLocale === 'he'}
                      />
                      <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
                        {t('actions.backToDashboard')}
                      </Button>
                    </>
                  )}
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
