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
import { Button } from '@/components/ui/button';
import { TIER_ORDER, type Tier, type BillingInterval } from '@/lib/billing/limits';

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

  // One coupon field for the whole grid rather than one per card — the
  // code applies to whichever plan you then pick. Validated here so the
  // discount is confirmed *before* anyone is sent to a payment page;
  // the actual redemption is only recorded once payment completes (see
  // lib/billing/coupons.ts).
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const isHe = locale === 'he';

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch('/api/billing/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        setCouponError(isHe ? 'יש להתחבר כדי להשתמש בקוד' : 'Sign in to use a code');
        return;
      }
      const data = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        code?: string;
        discountPercent?: number;
        error?: string;
      };
      if (!res.ok) {
        setCouponError(data.error ?? (isHe ? 'לא ניתן לבדוק את הקוד' : "Couldn't check that code"));
        return;
      }
      if (!data.valid) {
        const reasons: Record<string, string> = isHe
          ? {
              not_found: 'קוד לא קיים',
              expired: 'הקוד פג תוקף',
              usage_limit_reached: 'הקוד מוצה',
              already_redeemed: 'כבר השתמשתם בקוד הזה',
            }
          : {
              not_found: "That code doesn't exist",
              expired: 'That code has expired',
              usage_limit_reached: 'That code has been fully used',
              already_redeemed: "You've already used that code",
            };
        setCouponError(reasons[data.reason ?? ''] ?? (isHe ? 'קוד לא תקין' : 'Invalid code'));
        setCoupon(null);
        return;
      }
      setCoupon({ code: data.code!, discountPercent: data.discountPercent! });
    } catch (err) {
      setCouponError((err as Error).message);
    } finally {
      setCouponChecking(false);
    }
  }

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
            currentTier={currentTier}
            checkoutReady={checkoutReady}
            isAuthed={isAuthed}
            locale={locale}
            couponCode={coupon?.code ?? null}
          />
        ))}
      </div>

      {checkoutReady && isAuthed && (
        <div className="mx-auto mt-8 max-w-sm">
          {coupon ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {isHe
                  ? `הקוד ${coupon.code} הוחל — ${coupon.discountPercent}% הנחה`
                  : `${coupon.code} applied — ${coupon.discountPercent}% off`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput('');
                }}
                className="text-xs text-emerald-700 underline dark:text-emerald-300"
              >
                {isHe ? 'הסר' : 'Remove'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void applyCoupon();
                  }}
                  placeholder={isHe ? 'קוד קופון' : 'Coupon code'}
                  aria-label={isHe ? 'קוד קופון' : 'Coupon code'}
                  dir="ltr"
                  className="border-input bg-background/60 focus-visible:ring-brand-500/18 h-10 flex-1 rounded-xl border px-3.5 text-sm focus-visible:outline-none focus-visible:ring-4"
                />
                <button
                  type="button"
                  onClick={() => void applyCoupon()}
                  disabled={couponChecking || !couponInput.trim()}
                  className="glass hover:glass-strong h-10 rounded-xl px-4 text-sm font-medium disabled:opacity-50"
                >
                  {couponChecking ? '…' : isHe ? 'החל' : 'Apply'}
                </button>
              </div>
              {couponError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{couponError}</p>
              )}
            </>
          )}
        </div>
      )}

      {checkoutReady && (
        <p className="text-muted-foreground mt-8 text-center text-xs">
          {t.rich('agreeToTerms', {
            terms: (chunks) => (
              <Link href="/terms" className="hover:text-foreground underline transition-colors">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="hover:text-foreground underline transition-colors">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </>
  );
}

function TierCard({
  tier,
  interval,
  currentTier,
  checkoutReady,
  isAuthed,
  locale,
  couponCode,
}: {
  tier: TierData;
  interval: BillingInterval;
  currentTier: Tier;
  checkoutReady: boolean;
  isAuthed: boolean;
  /** Validated code from the shared field above, applied to this purchase. */
  couponCode?: string | null;
  locale: string;
}) {
  const t = useTranslations('billing');
  const [loading, setLoading] = useState(false);
  const isFeatured = tier.id === 'plus';
  const isFree = tier.id === 'free';
  // Anonymous visitors get `currentTier: 'free'` as a placeholder (the
  // server has no session to check) — without the `isAuthed` guard that
  // makes the Free card read as "Your current plan" (disabled) for
  // every signed-out visitor, when what they actually have is no plan
  // at all. Only treat it as "current" once there's a real session to
  // back that claim.
  const isCurrent = isAuthed && currentTier === tier.id;
  const isPaidUser = isAuthed && currentTier !== 'free';
  const isDowngrade =
    isAuthed && !isCurrent && TIER_ORDER.indexOf(tier.id) < TIER_ORDER.indexOf(currentTier);

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
        body: JSON.stringify({ priceKey, ...(couponCode ? { couponCode } : {}) }),
      });
      const data = (await res.json()) as { url?: string; changed?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to start checkout');
        return;
      }
      if (data.changed) {
        // Existing subscription was swapped in place (see
        // purchaseOrChangePlan) — nothing to redirect to. Reload so the
        // new tier is reflected everywhere (this card, the header, the
        // billing page) instead of prop-drilling a refetch.
        toast.success(t('planChanged'));
        window.location.reload();
        return;
      }
      if (!data.url) {
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
          <Button type="button" disabled variant="secondary" className="w-full">
            {t('currentTier')}
          </Button>
        ) : isFree ? (
          isPaidUser ? (
            // A paying user looking at the Free card is really asking
            // "how do I downgrade" — that's a cancellation, which needs
            // the fuller context (renewal date, usage) the billing page
            // already shows, not a bare click here.
            <Button asChild variant="outline" className="w-full">
              <Link href="/account/billing">{t('cancelSubscription')}</Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href="/sign-up">{t('getStarted')}</Link>
            </Button>
          )
        ) : !isAuthed ? (
          <Button asChild className="w-full">
            <Link href="/sign-in">{t('subscribe', { tier: tier.displayName })}</Link>
          </Button>
        ) : !checkoutReady ? (
          // Reachable only when isAuthed is true (the !isAuthed branch
          // above already caught anonymous visitors) — a signed-in user
          // looking to upgrade while checkout isn't live yet. Used to
          // be a bare mailto: link, which dead-ended outside the app
          // with no account context. /account/billing already shows
          // the same "coming soon" messaging (comingSoonBanner) in the
          // context of their actual plan, so that's the one place this
          // should point rather than duplicating the waitlist pitch
          // here. Waitlist is a distinct semantic state (you can't buy
          // this yet) — kept visually separate (amber tint) rather than
          // folded into the standard button so it doesn't read as a
          // normal, currently-working purchase action. Box model
          // (h-10 + px-5, flex-centered) still matches Button's `size:
          // default` exactly, though — this sits in the same card-footer
          // row as the other tiers' <Button>s, and a few px of padding-
          // driven height difference was visibly throwing the row out
          // of alignment.
          <Link
            href="/account/billing"
            className="glass-subtle ease-snappy inline-flex h-10 w-full items-center justify-center rounded-full px-5 text-sm font-medium text-amber-900 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96] dark:text-amber-100"
          >
            {t('seeInBilling')}
          </Link>
        ) : price <= 0 ? (
          <Button type="button" disabled variant="secondary" className="w-full">
            {locale === 'he' ? 'לא זמין' : 'Not available'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading}
            aria-busy={loading}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDowngrade
              ? t('downgradeTo', { tier: tier.displayName })
              : t('subscribe', { tier: tier.displayName })}
          </Button>
        )}
      </div>
    </div>
  );
}
