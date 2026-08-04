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
import { SUPPORT_MAILTO } from '@/lib/constants/contact';
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
              <BillingAction
                isPaid={isPaid}
                hasProviderCustomer={hasProviderCustomer}
                checkoutReady={providerInfo.checkoutReady}
                cancelAtPeriodEnd={cancelAtPeriodEnd}
                periodEndLabel={periodEndLabel}
                openPortalLabel={t('openPortal')}
                upgradeLabel={t('gate.upgradeCta')}
                manageLabel={t('manage')}
                waitlistLabel={t('joinWaitlist')}
              />
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

/**
 * The plan-card action slot — pulled out of the page body because the
 * five (isPaid × hasProviderCustomer × checkoutReady) states don't
 * collapse cleanly into a single ternary chain without one of them
 * silently falling through to the wrong branch (a real bug caught
 * here: an admin-granted paid user with checkoutReady=false briefly
 * saw "Join the waitlist", which makes no sense for someone who
 * already has access). Every case is listed explicitly instead.
 */
function BillingAction({
  isPaid,
  hasProviderCustomer,
  checkoutReady,
  cancelAtPeriodEnd,
  periodEndLabel,
  openPortalLabel,
  upgradeLabel,
  manageLabel,
  waitlistLabel,
}: {
  isPaid: boolean;
  hasProviderCustomer: boolean;
  checkoutReady: boolean;
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string | null;
  openPortalLabel: string;
  upgradeLabel: string;
  manageLabel: string;
  waitlistLabel: string;
}) {
  // Real paying customer (Stripe/LS on file) — always manageable,
  // regardless of whether *new* checkout is enabled.
  if (hasProviderCustomer) {
    return (
      <>
        <BillingPortalButton label={openPortalLabel} />
        <CancelSubscriptionButton
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          periodEndLabel={periodEndLabel}
        />
      </>
    );
  }

  // Admin-granted paid, no real provider customer: the grantedByAdmin
  // badge above already explains their access. If checkout is live
  // they can still browse plans/set up real billing; if not, there's
  // nothing self-service to offer — not even a "Manage" link, since
  // that would just be another /pricing round trip for someone who
  // doesn't need to buy anything.
  if (isPaid) {
    if (!checkoutReady) return null;
    return (
      <Button asChild>
        <Link href="/pricing">{manageLabel}</Link>
      </Button>
    );
  }

  // Free tier, checkout not live: /pricing can't complete a purchase
  // either (its own CTAs route signed-in users back here — see
  // pricing-client.tsx), so this would just bounce them straight back.
  // Complete the one real action (register interest) directly instead.
  if (!checkoutReady) {
    return (
      <Button asChild>
        <a href={`${SUPPORT_MAILTO}?subject=Waitlist%20-%20Billing`}>{waitlistLabel}</a>
      </Button>
    );
  }

  // Free tier, checkout live: the normal, real upgrade flow.
  return (
    <Button asChild>
      <Link href="/pricing">{upgradeLabel}</Link>
    </Button>
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
