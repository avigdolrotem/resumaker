/**
 * Payment provider facade.
 *
 * The rest of the app calls these functions without caring which
 * provider is live. Switching providers is a single env-var change
 * (`PAYMENT_PROVIDER=stripe|lemonsqueezy|none`).
 *
 * Currently supported:
 *   - 'stripe'       — Stripe Checkout + Customer Portal
 *   - 'lemonsqueezy' — LemonSqueezy Checkout (MoR, handles VAT for us)
 *   - 'none'         — payments disabled, all calls return DISABLED
 *
 * Each provider implementation lives in its own module:
 *   - lib/billing/stripe.ts
 *   - lib/billing/lemonsqueezy.ts
 */

import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';
import {
  getStripe,
  resolvePriceId,
  getPeriodEndUnix,
  mapStripeStatus,
  PRICE_IDS as STRIPE_PRICE_IDS,
} from './stripe';
import {
  createCheckoutUrl as lsCreateCheckoutUrl,
  getCustomerPortalUrl as lsGetCustomerPortalUrl,
  getPortalUrl as lsGetPortalUrl,
  updateSubscriptionPlan as lsUpdateSubscriptionPlan,
  setSubscriptionCancelled as lsSetSubscriptionCancelled,
  getVariantId,
} from './lemonsqueezy';

export type PaymentProvider = 'none' | 'stripe' | 'lemonsqueezy';

export type PriceKey =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'plus_quarterly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'pro_quarterly';

/**
 * Active payment provider, derived from env. Single source of truth.
 */
export function getActiveProvider(): PaymentProvider {
  return env.PAYMENT_PROVIDER;
}

// ─── CHECKOUT ───────────────────────────────────────────────────────

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; code: 'DISABLED' | 'PRICE_MISSING' | 'PROVIDER_ERROR'; message: string };

/**
 * Start a checkout session for the given user + price. Returns a URL
 * the client should redirect to (Stripe-hosted or LS-hosted).
 *
 * For Stripe: also creates a customer record if missing.
 * For LemonSqueezy: no customer pre-creation — LS makes one on first checkout.
 */
export async function startCheckout(args: {
  userId: string;
  userEmail: string;
  /** Validated coupon (see lib/billing/coupons.ts) — LemonSqueezy only. */
  coupon?: { id: string; code: string };
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
  /** UI locale of the buyer — passed to provider for receipt copy etc. */
  locale?: 'he' | 'en';
}): Promise<CheckoutResult> {
  const provider = getActiveProvider();

  if (provider === 'none') {
    return { ok: false, code: 'DISABLED', message: 'Payments are not enabled yet.' };
  }

  if (provider === 'stripe') {
    const priceId = STRIPE_PRICE_IDS[args.priceKey];
    if (!priceId) {
      return {
        ok: false,
        code: 'PRICE_MISSING',
        message: `Stripe price id missing for ${args.priceKey}`,
      };
    }

    const stripe = getStripe();
    const isOneTime = args.priceKey.endsWith('_quarterly');

    // Reuse existing customer if we have one. We do NOT pre-create a
    // customer just to write to our DB — that risks orphaning a Stripe
    // customer if the subsequent session.create call fails. Instead we
    // let Stripe create the customer inline during checkout, and the
    // webhook persists `stripeCustomerId` when the session completes.
    const existing = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, args.userId),
      columns: { stripeCustomerId: true },
    });
    const existingCustomerId = existing?.stripeCustomerId ?? null;

    try {
      // Stripe substitutes {CHECKOUT_SESSION_ID} server-side, so the
      // raw placeholder is correct in the URL we pass.
      const checkout = await stripe.checkout.sessions.create({
        mode: isOneTime ? 'payment' : 'subscription',
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: args.userEmail }),
        client_reference_id: args.userId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: { userId: args.userId, priceKey: args.priceKey },
        ...(isOneTime
          ? {
              payment_intent_data: {
                metadata: { userId: args.userId, priceKey: args.priceKey },
              },
            }
          : {
              subscription_data: {
                metadata: { userId: args.userId, priceKey: args.priceKey },
              },
            }),
      });
      if (!checkout.url) {
        return { ok: false, code: 'PROVIDER_ERROR', message: 'Stripe returned no URL' };
      }
      return { ok: true, url: checkout.url };
    } catch (err) {
      return {
        ok: false,
        code: 'PROVIDER_ERROR',
        message: (err as Error).message,
      };
    }
  }

  if (provider === 'lemonsqueezy') {
    const variantId = getVariantId(args.priceKey);
    if (!variantId) {
      return {
        ok: false,
        code: 'PRICE_MISSING',
        message: `LemonSqueezy variant id missing for ${args.priceKey}`,
      };
    }

    try {
      const url = await lsCreateCheckoutUrl({
        variantId,
        userId: args.userId,
        userEmail: args.userEmail,
        successUrl: args.successUrl,
        ...(args.locale ? { locale: args.locale } : {}),
        ...(args.coupon ? { discountCode: args.coupon.code, couponId: args.coupon.id } : {}),
      });
      // Mark the subscription row as "lemonsqueezy" provider so when the
      // webhook arrives we don't accidentally treat it as a Stripe row.
      await db
        .insert(schema.subscriptions)
        .values({ userId: args.userId, provider: 'lemonsqueezy' })
        .onConflictDoUpdate({
          target: schema.subscriptions.userId,
          set: { provider: 'lemonsqueezy', updatedAt: new Date() },
        });
      return { ok: true, url };
    } catch (err) {
      return {
        ok: false,
        code: 'PROVIDER_ERROR',
        message: (err as Error).message,
      };
    }
  }

  return {
    ok: false,
    code: 'PROVIDER_ERROR',
    message: `Unknown PAYMENT_PROVIDER: ${provider as string}`,
  };
}

// ─── SUBSCRIPTION SYNC (Stripe) ─────────────────────────────────────

/**
 * Write a Stripe subscription object's current state into our DB row.
 *
 * Shared by the webhook handler (`customer.subscription.updated`/
 * `created`) AND `changeSubscriptionPlan` below, which calls this
 * directly on the object `subscriptions.update()` returns so the tier
 * change is reflected immediately instead of waiting on the webhook
 * round-trip. Idempotent — the webhook's own delivery of the same
 * update is a harmless re-sync of identical data.
 */
export async function syncSubscriptionFromStripe(
  userId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) {
    logger.warn({ subId: sub.id }, 'stripe.subscription.no_price');
    return;
  }

  const resolved = resolvePriceId(priceId);
  if (!resolved) {
    logger.warn({ priceId, subId: sub.id }, 'stripe.subscription.unknown_price');
    return;
  }

  const periodEndUnix = getPeriodEndUnix(sub) ?? Math.floor(Date.now() / 1000);
  const stripeStatus = mapStripeStatus(sub.status);

  await db
    .insert(schema.subscriptions)
    .values({
      userId,
      provider: 'stripe',
      tier: resolved.tier,
      status: stripeStatus,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodEnd: new Date(periodEndUnix * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        provider: 'stripe',
        tier: resolved.tier,
        status: stripeStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodEnd: new Date(periodEndUnix * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

  auditEvent({
    userId,
    event: 'billing_subscription_updated',
    metadata: {
      stripeSubscriptionId: sub.id,
      tier: resolved.tier,
      interval: resolved.interval,
      status: sub.status,
    },
  });
}

// ─── PLAN CHANGE (upgrade/downgrade an existing subscription) ───────

export type ChangePlanResult =
  | { ok: true }
  | {
      ok: false;
      code: 'DISABLED' | 'NO_SUBSCRIPTION' | 'PRICE_MISSING' | 'PROVIDER_ERROR';
      message: string;
    };

/**
 * Swap an EXISTING subscription to a different tier/interval in place,
 * with proration — instead of starting a brand-new Checkout Session
 * (which would leave the old subscription running and double-bill the
 * customer). Both providers are configured to charge/credit the
 * prorated difference immediately: Stripe via `proration_behavior:
 * 'always_invoice'`, LemonSqueezy via `invoiceImmediately: true`. The
 * customer sees the fair price difference right away and gets the new
 * tier's access immediately, rather than a surprise line item next
 * cycle.
 *
 * Only for recurring subscriptions — one-time "Job Hunt Pack" price
 * keys aren't a subscription Stripe/LS can update in place, so callers
 * should route those through `startCheckout` as a fresh purchase.
 */
export async function changeSubscriptionPlan(args: {
  userId: string;
  priceKey: PriceKey;
}): Promise<ChangePlanResult> {
  const provider = getActiveProvider();
  if (provider === 'none') {
    return { ok: false, code: 'DISABLED', message: 'Payments are not enabled yet.' };
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, args.userId),
    columns: { provider: true, stripeSubscriptionId: true, lsSubscriptionId: true },
  });
  if (!sub) {
    return { ok: false, code: 'NO_SUBSCRIPTION', message: 'No subscription to change.' };
  }

  if (sub.provider === 'stripe') {
    if (!sub.stripeSubscriptionId) {
      return { ok: false, code: 'NO_SUBSCRIPTION', message: 'No active Stripe subscription.' };
    }
    const priceId = STRIPE_PRICE_IDS[args.priceKey];
    if (!priceId) {
      return {
        ok: false,
        code: 'PRICE_MISSING',
        message: `Stripe price id missing for ${args.priceKey}`,
      };
    }
    try {
      const stripe = getStripe();
      const current = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        return { ok: false, code: 'PROVIDER_ERROR', message: 'Subscription has no billable item.' };
      }
      const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'always_invoice',
        metadata: { userId: args.userId, priceKey: args.priceKey },
      });
      await syncSubscriptionFromStripe(args.userId, updated);
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  if (sub.provider === 'lemonsqueezy') {
    if (!sub.lsSubscriptionId) {
      return {
        ok: false,
        code: 'NO_SUBSCRIPTION',
        message: 'No active LemonSqueezy subscription.',
      };
    }
    const variantId = getVariantId(args.priceKey);
    if (!variantId) {
      return {
        ok: false,
        code: 'PRICE_MISSING',
        message: `LemonSqueezy variant id missing for ${args.priceKey}`,
      };
    }
    try {
      await lsUpdateSubscriptionPlan(sub.lsSubscriptionId, variantId);
      // No optimistic DB write here — same precedent as startCheckout's
      // LS branch below: LS fires subscription_updated for plan changes
      // the same way it does for new subscriptions, and the existing LS
      // webhook handler picks up the new variant/tier from there.
      auditEvent({
        userId: args.userId,
        event: 'billing_subscription_updated',
        metadata: { provider: 'lemonsqueezy', priceKey: args.priceKey },
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  return {
    ok: false,
    code: 'NO_SUBSCRIPTION',
    message: 'Current plan was not purchased through a payment provider.',
  };
}

/**
 * Start a checkout for a NEW subscriber, or transparently switch to
 * `changeSubscriptionPlan` when the user already has a live recurring
 * subscription — the caller (the /api/billing/checkout route) doesn't
 * need to know the difference. This is what actually prevents the
 * double-billing bug: without this check, an existing Plus subscriber
 * clicking "Upgrade to Pro" would start a second, independent Stripe
 * subscription rather than replacing the first.
 *
 * One-time "Job Hunt Pack" (`_quarterly`) purchases always go through
 * a fresh checkout — they're a different product class (a payment, not
 * a subscription) and there's nothing to update in place.
 */
export type PurchaseOrChangeResult =
  | { ok: true; mode: 'redirect'; url: string }
  | { ok: true; mode: 'changed' }
  | {
      ok: false;
      code: 'DISABLED' | 'NO_SUBSCRIPTION' | 'PRICE_MISSING' | 'PROVIDER_ERROR';
      message: string;
    };

export async function purchaseOrChangePlan(args: {
  userId: string;
  userEmail: string;
  /** Validated coupon — only applies to a NEW checkout, not a plan change. */
  coupon?: { id: string; code: string };
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
  locale?: 'he' | 'en';
}): Promise<PurchaseOrChangeResult> {
  const isOneTime = args.priceKey.endsWith('_quarterly');

  if (!isOneTime) {
    const existing = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, args.userId),
      columns: {
        provider: true,
        stripeSubscriptionId: true,
        lsSubscriptionId: true,
        status: true,
      },
    });
    const hasLiveSubscription =
      existing &&
      existing.status !== 'canceled' &&
      ((existing.provider === 'stripe' && existing.stripeSubscriptionId) ||
        (existing.provider === 'lemonsqueezy' && existing.lsSubscriptionId));

    if (hasLiveSubscription) {
      const result = await changeSubscriptionPlan({ userId: args.userId, priceKey: args.priceKey });
      if (!result.ok) return result;
      return { ok: true, mode: 'changed' };
    }
  }

  const result = await startCheckout(args);
  if (!result.ok) return result;
  return { ok: true, mode: 'redirect', url: result.url };
}

// ─── CANCEL / RESUME ────────────────────────────────────────────────

export type CancelPlanResult =
  | { ok: true }
  | { ok: false; code: 'DISABLED' | 'NO_SUBSCRIPTION' | 'PROVIDER_ERROR'; message: string };

/**
 * Schedule (or undo) cancellation of the user's own subscription.
 * Always "at period end", never immediate — the user keeps full access
 * through what they already paid for, matching the cancellation policy
 * described in /terms (Section 6) and the product's stated preference:
 * cancel now, keep access until the current paid period ends.
 *
 * (Immediate, full cancellation still exists separately for account
 * deletion — see /api/account's DELETE handler — since a deleted
 * account has no dashboard left to retain access to.)
 */
export async function setSubscriptionCancellation(args: {
  userId: string;
  cancel: boolean;
}): Promise<CancelPlanResult> {
  const provider = getActiveProvider();
  if (provider === 'none') {
    return { ok: false, code: 'DISABLED', message: 'Payments are not enabled yet.' };
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, args.userId),
    columns: { provider: true, stripeSubscriptionId: true, lsSubscriptionId: true },
  });
  if (!sub) {
    return { ok: false, code: 'NO_SUBSCRIPTION', message: 'No subscription to cancel.' };
  }

  if (sub.provider === 'stripe') {
    if (!sub.stripeSubscriptionId) {
      return { ok: false, code: 'NO_SUBSCRIPTION', message: 'No active Stripe subscription.' };
    }
    try {
      const updated = await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: args.cancel,
      });
      await syncSubscriptionFromStripe(args.userId, updated);
      auditEvent({
        userId: args.userId,
        event: args.cancel
          ? 'billing_subscription_cancel_scheduled'
          : 'billing_subscription_cancel_undone',
        metadata: { provider: 'stripe' },
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  if (sub.provider === 'lemonsqueezy') {
    if (!sub.lsSubscriptionId) {
      return {
        ok: false,
        code: 'NO_SUBSCRIPTION',
        message: 'No active LemonSqueezy subscription.',
      };
    }
    try {
      // LS's "cancelled" state is inherently a grace period until
      // `ends_at` — there's no separate immediate-vs-scheduled flag
      // like Stripe's; a cancelled LS subscription already keeps access
      // until period end by design. See lemonsqueezy.ts.
      await lsSetSubscriptionCancelled(sub.lsSubscriptionId, args.cancel);
      auditEvent({
        userId: args.userId,
        event: args.cancel
          ? 'billing_subscription_cancel_scheduled'
          : 'billing_subscription_cancel_undone',
        metadata: { provider: 'lemonsqueezy' },
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  return {
    ok: false,
    code: 'NO_SUBSCRIPTION',
    message: 'Current plan was not purchased through a payment provider.',
  };
}

// ─── CUSTOMER PORTAL ────────────────────────────────────────────────

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; code: 'DISABLED' | 'NO_CUSTOMER' | 'PROVIDER_ERROR'; message: string };

/**
 * Get a self-serve billing portal URL for the user. Stripe issues a
 * single-use URL; LS exposes a per-customer/subscription portal URL we
 * can cache and refresh on demand.
 */
export async function openCustomerPortal(args: {
  userId: string;
  returnUrl: string;
}): Promise<PortalResult> {
  const provider = getActiveProvider();
  if (provider === 'none') {
    return { ok: false, code: 'DISABLED', message: 'Payments are not enabled yet.' };
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, args.userId),
    columns: {
      provider: true,
      stripeCustomerId: true,
      lsCustomerId: true,
      lsSubscriptionId: true,
      lsCustomerPortalUrl: true,
    },
  });

  if (!sub) {
    return { ok: false, code: 'NO_CUSTOMER', message: 'No subscription record for user.' };
  }

  // Prefer the row's own provider — handles the case where a user
  // started on Stripe and we later switched the global default to LS
  // (their old sub keeps using Stripe portal).
  const rowProvider = sub.provider;

  if (rowProvider === 'stripe') {
    if (!sub.stripeCustomerId) {
      return { ok: false, code: 'NO_CUSTOMER', message: 'No Stripe customer for user.' };
    }
    try {
      const portal = await getStripe().billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: args.returnUrl,
      });
      return { ok: true, url: portal.url };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  if (rowProvider === 'lemonsqueezy') {
    // Try cached URL first, then re-fetch via API
    if (sub.lsCustomerPortalUrl) return { ok: true, url: sub.lsCustomerPortalUrl };

    try {
      let url: string | null = null;
      if (sub.lsSubscriptionId) {
        url = await lsGetPortalUrl(sub.lsSubscriptionId);
      } else if (sub.lsCustomerId) {
        url = await lsGetCustomerPortalUrl(sub.lsCustomerId);
      }
      if (!url) {
        return { ok: false, code: 'NO_CUSTOMER', message: 'No LS customer for user.' };
      }
      // Cache for next time
      await db
        .update(schema.subscriptions)
        .set({ lsCustomerPortalUrl: url, updatedAt: new Date() })
        .where(eq(schema.subscriptions.userId, args.userId));
      return { ok: true, url };
    } catch (err) {
      return { ok: false, code: 'PROVIDER_ERROR', message: (err as Error).message };
    }
  }

  return {
    ok: false,
    code: 'NO_CUSTOMER',
    message: 'User has no paid subscription (admin grant or free tier).',
  };
}

// ─── PRICING PAGE HELPER ────────────────────────────────────────────

/**
 * Public-safe info about the active provider — passed to the pricing
 * page so the CTA button can render the right copy.
 */
export interface ProviderInfo {
  provider: PaymentProvider;
  /** True when checkout is fully wired (provider + at least one price id). */
  checkoutReady: boolean;
  /** Display name shown in any "powered by" footer. */
  displayName: string;
}

export function getProviderInfo(): ProviderInfo {
  const provider = getActiveProvider();
  const checkoutReady = (() => {
    if (provider === 'stripe') return Boolean(STRIPE_PRICE_IDS.pro_monthly);
    if (provider === 'lemonsqueezy') return Boolean(getVariantId('pro_monthly'));
    return false;
  })();
  const displayName =
    provider === 'stripe' ? 'Stripe' : provider === 'lemonsqueezy' ? 'LemonSqueezy' : 'none';
  return { provider, checkoutReady, displayName };
}
