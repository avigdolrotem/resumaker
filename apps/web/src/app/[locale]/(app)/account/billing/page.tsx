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
import { BillingPortalButton } from './portal-button';

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {tier === 'pro' ? (
                  <Crown className="text-violet-500" />
                ) : tier === 'plus' ? (
                  <ShieldCheck className="text-amber-500" />
                ) : null}
                {limits.displayName[locale]}
              </CardTitle>
              <CardDescription>{t('currentTier')}</CardDescription>
              {grantedByAdmin && (
                <p className="mt-2 inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-xs text-violet-800">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('grantedByAdmin')}
                </p>
              )}
              {sub?.currentPeriodEnd && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {sub.cancelAtPeriodEnd ? '⚠ ' : ''}
                  {locale === 'he' ? 'תאריך החיוב הבא: ' : 'Next renewal: '}
                  <span dir="ltr">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
                </p>
              )}
            </div>
            <div>
              {isPaid && hasProviderCustomer ? (
                <BillingPortalButton label={t('openPortal')} />
              ) : (
                <Link
                  href="/pricing"
                  className="bg-brand-600 hover:bg-brand-700 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition"
                >
                  {tier === 'free' ? t('gate.upgradeCta') : t('manage')}
                </Link>
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
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {current}
        <span className="text-muted-foreground ms-1 text-sm font-normal">
          {isUnlimited ? `(${unlimited})` : isDisabled ? '' : `${of} ${limit}`}
        </span>
      </p>
      {!isUnlimited && !isDisabled && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className={`h-full rounded-full ${isNearLimit ? 'bg-amber-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
