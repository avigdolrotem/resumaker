'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DollarSign, Loader2 } from 'lucide-react';

interface SalaryResult {
  min: number;
  max: number;
  currency: string;
  rationale: string;
}

export default function SalaryEstimatorPage() {
  const t = useTranslations('tools.salaryEstimator');
  const [role, setRole] = useState('');
  const [years, setYears] = useState('');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/tools/salary-estimator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, years: Number(years), location, industry }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Request failed');
      }
      const data = (await res.json()) as SalaryResult;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main" className="min-h-screen bg-gradient-to-b from-neutral-50 to-white py-20">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
            <DollarSign className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-3">{t('description')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-border rounded-2xl border bg-white p-8 shadow-sm"
        >
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.role')}</span>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t('fields.rolePlaceholder')}
                required
                className="border-input w-full rounded-md border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.years')}</span>
              <input
                type="number"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                placeholder="5"
                min={0}
                max={40}
                required
                className="border-input w-full rounded-md border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.location')}</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('fields.locationPlaceholder')}
                required
                className="border-input w-full rounded-md border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.industry')}</span>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={t('fields.industryPlaceholder')}
                className="border-input w-full rounded-md border px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('estimating') : t('estimate')}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
            <h2 className="mb-4 text-lg font-bold text-emerald-900">{t('result.title')}</h2>
            <div className="mb-4 text-4xl font-bold text-emerald-700">
              {result.currency}
              {result.min.toLocaleString()} – {result.currency}
              {result.max.toLocaleString()}
            </div>
            <p className="text-sm text-emerald-800">{result.rationale}</p>
          </div>
        )}
      </div>
    </main>
  );
}
