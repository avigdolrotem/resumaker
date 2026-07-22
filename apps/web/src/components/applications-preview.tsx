'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from '@/components/upgrade-modal';

/**
 * "Locked" preview shown on /applications when the user doesn't have the
 * `jobHuntBeta` flag. Mirrors `JobHuntPreview` (/jobs) — same beta flag,
 * same soft-gate pattern, so a non-beta user never hits a silent
 * dead-end redirect on either half of the job-hunt surface.
 *
 * Background = blurred sample tracked-application cards (fixed fake
 * data, no DB call). Foreground = an upsell card that opens the
 * existing `UpgradeModal` with `feature='application_tracking_beta'`
 * — a distinct entry from /jobs' `job_hunt_beta` even though both
 * gate on the same underlying flag, so the modal's own copy doesn't
 * suddenly start talking about "Job Hunt" after a click that started
 * on the Applications page.
 */
export function ApplicationsPreview() {
  const t = useTranslations('applications.betaGate');
  const tApplications = useTranslations('applications');
  const tStatuses = useTranslations('applications.statuses');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="relative">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{tApplications('title')}</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
              {tApplications('betaBadge')}
            </span>
            <Lock className="text-muted-foreground h-4 w-4" aria-hidden />
          </div>
          <p className="text-muted-foreground mt-1">{tApplications('subtitle')}</p>
        </div>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none select-none space-y-3 blur-sm">
          {SAMPLE_APPLICATIONS.map((a) => (
            <Card key={a.id} className="opacity-70">
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{a.jobTitle}</h3>
                    <p className="text-muted-foreground text-sm">{a.jobCompany}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {tStatuses(a.status)}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">{a.updatedAgo}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="absolute inset-0 flex items-start justify-center pt-16">
          <Card className="border-brand-200 dark:border-brand-800 bg-card/95 max-w-md text-center shadow-2xl backdrop-blur-sm">
            <CardContent className="space-y-4 pb-6 pt-8">
              <div className="bg-brand-100 dark:bg-brand-900/40 mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl">
                <TrendingUp className="text-brand-600 dark:text-brand-300 h-6 w-6" />
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
        feature="application_tracking_beta"
        requiredTier="plus"
      />
    </div>
  );
}

/**
 * Fake tracked applications used purely as visual chrome behind the
 * blur. No real postings, no DB call.
 */
const SAMPLE_APPLICATIONS: ReadonlyArray<{
  id: string;
  jobTitle: string;
  jobCompany: string;
  status: 'applied' | 'recruiter_screen' | 'tech_interview' | 'onsite';
  updatedAgo: string;
}> = [
  {
    id: '1',
    jobTitle: 'Senior Full-Stack Engineer',
    jobCompany: 'Wix',
    status: 'tech_interview',
    updatedAgo: '2d ago',
  },
  {
    id: '2',
    jobTitle: 'Frontend Engineer (React)',
    jobCompany: 'Monday.com',
    status: 'recruiter_screen',
    updatedAgo: '4d ago',
  },
  {
    id: '3',
    jobTitle: 'Backend Tech Lead',
    jobCompany: 'Riskified',
    status: 'applied',
    updatedAgo: '1w ago',
  },
];
