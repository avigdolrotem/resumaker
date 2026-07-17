'use client';

/**
 * Pricing page client shell.
 *
 * Renders the interval toggle (Monthly / Yearly / 3-month "Job Hunt Pack")
 * and the three tier cards. Hoisted as a single client component so
 * toggling the interval doesn't trigger a server round-trip.
 *
 * Locked into the chosen interval, each card delegates the actual
 * "buy" action to <TierCard /> below.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import type { Tier, BillingInterval } from '@/lib/billing/limits';

interface TierData {
  id: Tier;
  displayName: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  priceQuarterly: number;
  features: string[];
}

const INTERVAL_ORDER: BillingInterval[] = ['monthly', 'yearly', 'quarterly'];

export function PricingClient({
  tiers,
  currentTier,
  checkoutReady,
  isAuthed,
  locale,
}: {
  tiers: TierData[];
  currentTier: Tier;
  checkoutReady: boolean;
  isAuthed: boolean;
  locale: string;
}) {
  const t = useTranslations('billing');
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <>
      {/* Interval toggle — hidden when only Free tier exists (no paid options to compare) */}
      <div className="mt-10 flex justify-center">
        <div
          role="tablist"
          aria-label={locale === 'he' ? 'בחר תקופת חיוב' : 'Select billing period'}
          className="glass-subtle inline-flex rounded-full p-1"
        >
          {INTERVAL_ORDER.map((intv) => (
            <button
              key={intv}
              type="button"
              role="tab"
              aria-selected={interval === intv}
              onClick={() => setInterval(intv)}
              className={`ease-snappy relative rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.96] ${
                interval === intv
                  ? 'text-foreground bg-card shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(intv)}
              {intv === 'yearly' && (
                <span className="ms-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                  -17%
                </span>
              )}
              {intv === 'quarterly' && (
                <span className="ms-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  {locale === 'he' ? 'חד פעמי' : 'one-time'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            interval={interval}
            isCurrent={currentTier === tier.id}
            checkoutReady={checkoutReady}
            isAuthed={isAuthed}
            locale={locale}
          />
        ))}
      </div>
    </>
  );
}

function TierCard({
  tier,
  interval,
  isCurrent,
  checkoutReady,
  isAuthed,
  locale,
}: {
  tier: TierData;
  interval: BillingInterval;
  isCurrent: boolean;
  checkoutReady: boolean;
  isAuthed: boolean;
  locale: string;
}) {
  const t = useTranslations('billing');
  const [loading, setLoading] = useState(false);
  const isFeatured = tier.id === 'plus';
  const isFree = tier.id === 'free';

  // Pick the price the user toggled into. -1 means "not offered for
  // this tier × interval" (e.g. Free doesn't have a yearly).
  const price =
    interval === 'monthly'
      ? tier.priceMonthly
      : interval === 'yearly'
        ? tier.priceYearly
        : tier.priceQuarterly;
  const priceLabel = isFree ? t('free') : price > 0 ? `₪${price}` : null;
  const intervalLabel = isFree
    ? ''
    : interval === 'monthly'
      ? t('monthly')
      : interval === 'yearly'
        ? t('yearly')
        : t('billedOnce');

  // Per-month equivalent for the quarterly pack — clearer for shoppers
  const perMonthLabel =
    !isFree && interval === 'quarterly' && price > 0
      ? `≈ ₪${(price / 3).toFixed(0)}/${t('monthly').replace(/^per /, '')}`
      : null;

  async function startCheckout() {
    if (isFree) return;
    setLoading(true);
    try {
      const priceKey = `${tier.id}_${interval}` as
        | 'plus_monthly'
        | 'plus_yearly'
        | 'plus_quarterly'
        | 'pro_monthly'
        | 'pro_yearly'
        | 'pro_quarterly';
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Failed to start checkout');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`ease-smooth relative flex flex-col rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 ${
        isFeatured
          ? 'glass ring-brand-200 dark:ring-brand-700/40 hover:shadow-glass-lg ring-4'
          : 'glass-subtle hover:glass'
      }`}
    >
      {isFeatured && (
        <span className="from-brand-500 to-accent-500 absolute -top-3 start-6 rounded-full bg-gradient-to-br px-3 py-0.5 text-xs font-semibold text-white shadow-md">
          {locale === 'he' ? 'הכי פופולרי' : 'Most popular'}
        </span>
      )}

      <div>
        <h2 className="text-2xl font-bold">{tier.displayName}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{tier.tagline}</p>
        <div className="mt-4 min-h-[3rem]">
          {priceLabel ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{priceLabel}</span>
              {intervalLabel && (
                <span className="text-muted-foreground text-sm">
                  {interval === 'monthly' ? `/${intervalLabel}` : ` · ${intervalLabel}`}
                </span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm italic">
              {locale === 'he' ? 'לא זמין בתוכנית הזו' : 'Not available on this plan'}
            </p>
          )}
          {perMonthLabel && <p className="text-muted-foreground mt-1 text-xs">{perMonthLabel}</p>}
        </div>
      </div>

      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="text-brand-600 mt-0.5 h-4 w-4 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="text-muted-foreground bg-muted w-full cursor-not-allowed rounded-full px-4 py-2.5 text-sm font-medium"
          >
            {t('currentTier')}
          </button>
        ) : isFree ? (
          <Link
            href="/sign-up"
            className="from-brand-500 to-accent-500 hover:shadow-brand-500/30 ease-snappy block w-full rounded-full bg-gradient-to-br px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96]"
          >
            {t('subscribe', { tier: t('free') })}
          </Link>
        ) : !isAuthed ? (
          <Link
            href="/sign-in"
            className="from-brand-500 to-accent-500 hover:shadow-brand-500/30 ease-snappy block w-full rounded-full bg-gradient-to-br px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96]"
          >
            {t('subscribe', { tier: tier.displayName })}
          </Link>
        ) : !checkoutReady ? (
          <a
            href="mailto:hello@resumaker.co.il?subject=Waitlist%20-%20Pricing"
            className="glass-subtle ease-snappy block w-full rounded-full px-4 py-2.5 text-center text-sm font-medium text-amber-900 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96] dark:text-amber-100"
          >
            {t('joinWaitlist')}
          </a>
        ) : price <= 0 ? (
          <button
            type="button"
            disabled
            className="bg-muted text-muted-foreground/80 w-full cursor-not-allowed rounded-full px-4 py-2.5 text-sm font-medium"
          >
            {locale === 'he' ? 'לא זמין' : 'Not available'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading}
            aria-busy={loading}
            className="from-brand-500 to-accent-500 hover:shadow-brand-500/30 ease-snappy inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('subscribe', { tier: tier.displayName })}
          </button>
        )}
      </div>
    </div>
  );
}
