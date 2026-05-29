'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Briefcase, Lock, Sparkles, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from '@/components/upgrade-modal';

/**
 * "Locked" preview shown on /jobs when the user doesn't have the
 * `jobHuntBeta` flag. Replaces the previous redirect-to-/dashboard
 * silent gate — users now SEE what the feature is and can request
 * access from the same page (creates demand, no surprise dead-end).
 *
 * Background = blurred sample job cards (fixed fake data, no DB
 * call). Foreground = an upsell card that opens the existing
 * `UpgradeModal` with `feature='job_hunt_beta'` (already wired into
 * the gate-modal copy / mailto waitlist CTA).
 */
export function JobHuntPreview() {
  const t = useTranslations('jobs.betaGate');
  const tJobs = useTranslations('jobs');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="relative">
      {/* Header with beta badge + lock — matches the real /jobs
          header layout so the page geometry doesn't jump for users
          who eventually get the flag. */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{tJobs('title')}</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
              {tJobs('betaBadge')}
            </span>
            <Lock className="text-muted-foreground h-4 w-4" aria-hidden />
          </div>
          <p className="text-muted-foreground mt-1">{tJobs('subtitle')}</p>
        </div>
      </div>

      {/* Stacked layer: blurred preview underneath, locked CTA on top.
          `select-none` + `pointer-events-none` so the blurred cards
          are decoratively-only (no accidental clicks into ghost UIs). */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none grid select-none gap-3 blur-sm lg:grid-cols-2"
        >
          {SAMPLE_JOBS.map((j) => (
            <Card key={j.id} className="opacity-70">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-semibold">{j.title}</h3>
                    <p className="text-muted-foreground line-clamp-1 text-sm">
                      {j.company} · {j.location}
                    </p>
                  </div>
                  {j.starred && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{j.source} · 2d ago</span>
                  <span className="rounded bg-violet-100 px-2 py-0.5 font-medium text-violet-700">
                    {j.fit}/10
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overlay CTA — centred, on-brand, dismissable to peek at the
            blur underneath isn't a goal; clicking the button opens
            the existing UpgradeModal (mailto: waitlist). */}
        <div className="absolute inset-0 flex items-start justify-center pt-16">
          <Card className="border-brand-200 dark:border-brand-800 bg-card/95 max-w-md text-center shadow-2xl backdrop-blur-sm">
            <CardContent className="space-y-4 pb-6 pt-8">
              <div className="bg-brand-100 dark:bg-brand-900/40 mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl">
                <Briefcase className="text-brand-600 dark:text-brand-300 h-6 w-6" />
              </div>
              <div>
                <h2 className="text-foreground text-xl font-semibold">{t('title')}</h2>
                <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="w-full" size="lg">
                <Sparkles className="me-2 h-4 w-4" />
                {t('ctaButton')}
              </Button>
              <p className="text-muted-foreground text-xs">{t('note')}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        feature="job_hunt_beta"
        requiredTier="plus"
      />
    </div>
  );
}

/**
 * Fake jobs used purely as visual chrome behind the blur. No real
 * postings, no DB call — keeps the page snappy for locked users and
 * means we never leak someone else's saved searches.
 */
const SAMPLE_JOBS: ReadonlyArray<{
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  fit: number;
  starred: boolean;
}> = [
  {
    id: '1',
    title: 'Senior Full-Stack Engineer',
    company: 'Wix',
    location: 'Tel Aviv',
    source: 'comeet',
    fit: 9,
    starred: true,
  },
  {
    id: '2',
    title: 'Frontend Engineer (React)',
    company: 'Monday.com',
    location: 'Remote',
    source: 'greenhouse',
    fit: 8,
    starred: false,
  },
  {
    id: '3',
    title: 'Backend Tech Lead',
    company: 'Riskified',
    location: 'Tel Aviv',
    source: 'lever',
    fit: 7,
    starred: false,
  },
  {
    id: '4',
    title: 'Platform Engineer',
    company: 'JFrog',
    location: 'Netanya',
    source: 'comeet',
    fit: 8,
    starred: true,
  },
];
