'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileSearch, Loader2 } from 'lucide-react';

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
    <main id="main" className="min-h-screen bg-gradient-to-b from-neutral-50 to-white py-20">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-lg">
            <FileSearch className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-3 text-neutral-600">{t('description')}</p>
          <p className="mt-1 text-xs text-neutral-400">{t('noAuthRequired')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
        >
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.jobDescription')}</span>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={t('fields.jdPlaceholder')}
                required
                rows={6}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.resumeText')}</span>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder={t('fields.resumePlaceholder')}
                required
                rows={8}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-purple-700 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('scanning') : t('scan')}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
              <div className={`text-6xl font-bold ${scoreColor}`}>{result.score}%</div>
              <div className="mt-2 text-sm text-neutral-600">{t('result.atsScore')}</div>
              <p className="mt-4 text-sm text-neutral-700">{result.summary}</p>
            </div>

            {result.missing.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h3 className="mb-3 font-semibold text-red-900">{t('result.missingKeywords')}</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-800"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.matched.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="mb-3 font-semibold text-emerald-900">
                  {t('result.matchedKeywords')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.matched.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800"
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
    </main>
  );
}
