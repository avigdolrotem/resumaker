'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileSearch, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';

interface ATSScanResult {
  score: number;
  matched: string[];
  missing: string[];
  summary: string;
}

export default function ATSScannerPage() {
  const t = useTranslations('tools.atsScanner');
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ATSScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/tools/ats-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd, resumeText: resume }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Request failed');
      }
      const data = (await res.json()) as ATSScanResult;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = !result
    ? ''
    : result.score >= 75
      ? 'text-emerald-600'
      : result.score >= 50
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="dark:from-background dark:to-card/30 from-background/0 to-background relative min-h-screen overflow-hidden bg-gradient-to-b py-20">
      <AnimatedMeshBg intensity="subtle" />
      <div className="container relative mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-lg">
            <FileSearch className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-3">{t('description')}</p>
          <p className="text-muted-foreground/80 mt-1 text-xs">{t('noAuthRequired')}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass animate-liquid-pop rounded-2xl p-8">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.jobDescription')}</span>
              <Textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={t('fields.jdPlaceholder')}
                required
                rows={6}
                className="focus-visible:ring-purple-500/18 focus-visible:border-purple-400/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.resumeText')}</span>
              <Textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder={t('fields.resumePlaceholder')}
                required
                rows={8}
                className="focus-visible:ring-purple-500/18 focus-visible:border-purple-400/60"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="ease-snappy mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-purple-600 to-violet-700 text-sm font-medium text-white shadow-lg shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/45 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('scanning') : t('scan')}
          </button>
        </form>

        {error && (
          <div className="glass-subtle mt-6 rounded-xl border-red-200/60 p-4 text-sm text-red-700 dark:border-red-800/50 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="glass animate-liquid-pop rounded-2xl p-8 text-center">
              <div className={`text-6xl font-bold ${scoreColor}`}>{result.score}%</div>
              <div className="text-muted-foreground mt-2 text-sm">{t('result.atsScore')}</div>
              <p className="text-foreground mt-4 text-sm">{result.summary}</p>
            </div>

            {result.missing.length > 0 && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/70 p-6 backdrop-blur-md dark:border-red-800/50 dark:bg-red-950/30">
                <h3 className="mb-3 font-semibold text-red-900 dark:text-red-200">
                  {t('result.missingKeywords')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-800 dark:bg-red-950/60 dark:text-red-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.matched.length > 0 && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/70 p-6 backdrop-blur-md dark:border-emerald-800/50 dark:bg-emerald-950/30">
                <h3 className="mb-3 font-semibold text-emerald-900 dark:text-emerald-200">
                  {t('result.matchedKeywords')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.matched.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
