'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DollarSign, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';

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
    <div className="dark:from-background dark:to-card/30 from-background/0 to-background relative min-h-screen overflow-hidden bg-gradient-to-b py-20">
      <AnimatedMeshBg intensity="subtle" />
      <div className="container relative mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
            <DollarSign className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-3">{t('description')}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass animate-liquid-pop rounded-2xl p-8">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.role')}</span>
              <Input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t('fields.rolePlaceholder')}
                required
                className="focus-visible:ring-emerald-500/18 focus-visible:border-emerald-400/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.years')}</span>
              <Input
                type="number"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                placeholder="5"
                min={0}
                max={40}
                required
                className="focus-visible:ring-emerald-500/18 focus-visible:border-emerald-400/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.location')}</span>
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('fields.locationPlaceholder')}
                required
                className="focus-visible:ring-emerald-500/18 focus-visible:border-emerald-400/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('fields.industry')}</span>
              <Input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={t('fields.industryPlaceholder')}
                className="focus-visible:ring-emerald-500/18 focus-visible:border-emerald-400/60"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="ease-snappy mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/45 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t('estimating') : t('estimate')}
          </button>
        </form>

        {error && (
          <div className="glass-subtle mt-6 rounded-xl border-red-200/60 p-4 text-sm text-red-700 dark:border-red-800/50 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="animate-liquid-pop mt-6 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-8 backdrop-blur-md dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <h2 className="mb-4 text-lg font-bold text-emerald-900 dark:text-emerald-200">
              {t('result.title')}
            </h2>
            <div className="mb-4 text-4xl font-bold text-emerald-700 dark:text-emerald-300">
              {result.currency}
              {result.min.toLocaleString()} – {result.currency}
              {result.max.toLocaleString()}
            </div>
            <p className="text-sm text-emerald-800 dark:text-emerald-200">{result.rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
}
