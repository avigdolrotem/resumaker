/**
 * /account/billing — user-facing billing settings.
 *
 * Shows current tier, usage vs limits, and either:
 *   - upgrade button (free tier → /pricing)
 *   - portal button (paid tier with Stripe customer)
 *   - "granted by admin" notice (no portal access)
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Crown, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import {
  getUserTier,
  getActiveResumeCount,
  getGenerationsToday,
  getCoverLettersThisMonth,
} from '@/lib/billing/tier';
import { TIER_LIMITS } from '@/lib/billing/limits';
import { getProviderInfo } from '@/lib/billing/provider';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BillingPortalButton } from './portal-button';
import { CancelSubscriptionButton } from './cancel-button';

export const dynamic = 'force-dynamic';

export default async function AccountBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: 'he' | 'en' };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${locale}/sign-in?next=/account/billing`);

  const t = await getTranslations({ locale, namespace: 'billing' });
  // `billing.pageTitle`/`pageSubtitle` are the /pricing marketing page's
  // copy ("Simple pricing…") — wrong for this settings page. Reuse the
  // nav label instead (same convention as every other page here: h1 text
  // == nav.<page> == the label already shown in the header/avatar menu).
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const userId = session.user.id;
  const [tier, resumeCount, generationsToday, coverLettersThisMonth, sub] = await Promise.all([
    getUserTier(userId),
    getActiveResumeCount(userId),
    getGenerationsToday(userId),
    getCoverLettersThisMonth(userId),
    db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, userId),
      columns: {
        grantedBy: true,
        stripeCustomerId: true,
        lsCustomerId: true,
        provider: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ]);

  const limits = TIER_LIMITS[tier];
  const isPaid = tier !== 'free';
  const providerInfo = getProviderInfo();
  // Show portal button if user has either provider's customer record
  const hasProviderCustomer = Boolean(sub?.stripeCustomerId || sub?.lsCustomerId);
  const grantedByAdmin = Boolean(sub?.grantedBy);
  const cancelAtPeriodEnd = Boolean(sub?.cancelAtPeriodEnd);
  const periodEndLabel = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{tNav('billing')}</h1>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {tier === 'pro' ? (
                  <Crown className="h-6 w-6 text-violet-500" />
                ) : tier === 'plus' ? (
                  <ShieldCheck className="h-6 w-6 text-amber-500" />
                ) : null}
                {limits.displayName[locale]}
              </CardTitle>
              <CardDescription>{t('currentTier')}</CardDescription>
              {grantedByAdmin && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('grantedByAdmin')}
                </p>
              )}
              {periodEndLabel && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {cancelAtPeriodEnd ? '⚠ ' : ''}
                  {cancelAtPeriodEnd
                    ? locale === 'he'
                      ? 'המנוי יבוטל בתאריך: '
                      : 'Cancels on: '
                    : locale === 'he'
                      ? 'תאריך החיוב הבא: '
                      : 'Next renewal: '}
                  <span dir="ltr">{periodEndLabel}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isPaid && hasProviderCustomer ? (
                <>
                  <BillingPortalButton label={t('openPortal')} />
                  <CancelSubscriptionButton
                    cancelAtPeriodEnd={cancelAtPeriodEnd}
                    periodEndLabel={periodEndLabel}
                  />
                </>
              ) : !providerInfo.checkoutReady ? (
                // Checkout isn't live — linking to /pricing here used to
                // send free users on a pointless round trip: pricing's own
                // CTAs (pricing-client.tsx) route a signed-in user back to
                // /account/billing when checkout isn't ready, so "Upgrade
                // now" → /pricing → back to billing never let anyone
                // actually do anything. Complete the one real action
                // (register interest) right here instead of bouncing them
                // through a page that can't fulfill it either.
                <Button asChild>
                  <a href="mailto:hello@resumaker.co.il?subject=Waitlist%20-%20Billing">
                    {t('joinWaitlist')}
                  </a>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/pricing">
                    {tier === 'free' ? t('gate.upgradeCta') : t('manage')}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('usage.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <UsageTile
              label={t('usage.resumes')}
              current={resumeCount}
              limit={limits.maxResumes}
              unlimited={t('usage.unlimited')}
              of={t('usage.of')}
            />
            <UsageTile
              label={t('usage.generationsToday')}
              current={generationsToday}
              limit={limits.generationsPerDay}
              unlimited={t('usage.unlimited')}
              of={t('usage.of')}
            />
            <UsageTile
              label={t('usage.coverLettersThisMonth')}
              current={coverLettersThisMonth}
              limit={limits.coverLettersPerMonth}
              unlimited={t('usage.unlimited')}
              of={t('usage.of')}
            />
          </div>
        </CardContent>
      </Card>

      {!providerInfo.checkoutReady && (
        <p className="text-muted-foreground text-center text-xs">{t('comingSoonBanner')}</p>
      )}
    </div>
  );
}

function UsageTile({
  label,
  current,
  limit,
  unlimited,
  of,
}: {
  label: string;
  current: number;
  limit: number;
  unlimited: string;
  of: string;
}) {
  const isUnlimited = limit === -1;
  const isDisabled = limit === 0;
  const pct = isUnlimited || isDisabled ? 0 : Math.min(100, (current / limit) * 100);
  const isNearLimit = pct >= 80;

  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {current}
        <span className="text-muted-foreground ms-1 text-sm font-normal">
          {isUnlimited ? `(${unlimited})` : isDisabled ? '' : `${of} ${limit}`}
        </span>
      </p>
      {!isUnlimited && !isDisabled && (
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className={`ease-smooth h-full rounded-full transition-all duration-500 ${isNearLimit ? 'bg-amber-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
