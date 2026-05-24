/**
 * Public /pricing page.
 *
 * Server component — renders the 3 tiers from TIER_LIMITS. The price card
 * + CTA are a client component so users can toggle between billing
 * intervals (monthly / yearly / Job Hunt Pack 3-month) without a round-trip.
 */

import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { Sparkles } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getUserTier } from '@/lib/billing/tier';
import { TIER_LIMITS, TIER_ORDER, type Tier } from '@/lib/billing/limits';
import { getProviderInfo } from '@/lib/billing/provider';
import { PricingClient } from './pricing-client';

export const dynamic = 'force-dynamic';

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: 'he' | 'en' };
  const t = await getTranslations({ locale, namespace: 'billing' });

  const session = await auth.api.getSession({ headers: await headers() });
  const currentTier: Tier = session ? await getUserTier(session.user.id) : 'free';
  const provider = getProviderInfo();
  const checkoutReady = provider.checkoutReady;

  // Pre-compute per-tier feature lists server-side (avoids leaking limits
  // logic to the client bundle).
  const tiers = TIER_ORDER.map((tier) => {
    const limits = TIER_LIMITS[tier];
    const features: string[] = [];

    features.push(
      limits.maxResumes === -1
        ? t('features.maxResumesUnlimited')
        : t('features.maxResumes', { count: limits.maxResumes }),
    );
    features.push(
      limits.generationsPerDay === -1
        ? t('features.generationsUnlimited')
        : t('features.generationsPerDay', { count: limits.generationsPerDay }),
    );
    if (limits.coverLettersPerMonth !== 0) {
      features.push(
        limits.coverLettersPerMonth === -1
          ? t('features.coverLettersUnlimited')
          : t('features.coverLettersPerMonth', { count: limits.coverLettersPerMonth }),
      );
    }
    if (limits.atsScoring && limits.atsScoring !== 'none') {
      features.push(t('features.atsScoring'));
    }
    if (limits.modelChoice) features.push(t('features.modelChoice'));
    features.push(
      limits.versionHistoryDays === -1
        ? t('features.versionHistoryUnlimited')
        : t('features.versionHistoryDays', { days: limits.versionHistoryDays }),
    );
    features.push(
      limits.totalTemplates >= 5
        ? t('features.templatesAll')
        : t('features.templates', { count: limits.totalTemplates }),
    );
    if (limits.removeBranding) features.push(t('features.removeBranding'));
    if (limits.prioritySupport) features.push(t('features.prioritySupport'));

    return {
      id: tier,
      displayName: limits.displayName[locale],
      tagline: limits.tagline[locale],
      priceMonthly: limits.priceMonthly,
      priceYearly: limits.priceYearly,
      priceQuarterly: limits.priceQuarterly,
      features,
    };
  });

  return (
    <main className="container mx-auto max-w-6xl px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-4 text-lg">{t('pageSubtitle')}</p>
        {!checkoutReady && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800">
            <Sparkles className="h-4 w-4" />
            {t('comingSoonBanner')}
          </div>
        )}
      </header>

      <PricingClient
        tiers={tiers}
        currentTier={currentTier}
        checkoutReady={checkoutReady}
        isAuthed={Boolean(session)}
        locale={locale}
      />
    </main>
  );
}
