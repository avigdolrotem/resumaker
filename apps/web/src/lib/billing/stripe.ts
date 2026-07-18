/**
 * Stripe client wrapper. Dormant unless PAYMENT_PROVIDER=stripe.
 *
 * This module is safe to import even when Stripe isn't configured —
 * `getStripe()` throws a clear error if called without env vars, but
 * the import itself is a no-op. That lets API routes import this at
 * top-level without breaking when Stripe is off.
 *
 * Wire-up steps (do these later, when ready to charge):
 *   1. Sign up at https://stripe.com (or use Stripe Atlas for the US LLC route)
 *   2. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
 *   3. Set PAYMENT_PROVIDER=stripe
 *   4. Create products in dashboard, paste price IDs into STRIPE_PRICE_* env vars
 *   5. In the Stripe Dashboard, add a webhook endpoint at
 *      `https://resumaker.co.il/api/billing/webhook` and copy the
 *      signing secret into STRIPE_WEBHOOK_SECRET.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

let _stripe: Stripe | null = null;

/**
 * Lazy singleton Stripe client. Throws if STRIPE_SECRET_KEY is unset.
 * Always wrap calls in `if (env.PAYMENT_PROVIDER === 'stripe')` at the call site.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY and PAYMENT_PROVIDER=stripe.');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 10_000,
  });
  return _stripe;
}

/**
 * Stripe Price IDs per tier × interval. Fill these in from the Stripe
 * Dashboard after creating products. Use test mode IDs in non-prod envs.
 *
 * Naming: `<tier>_<interval>` — plus_monthly, pro_yearly, plus_quarterly, etc.
 * `_quarterly` is the 3-month one-time "Job Hunt Pack" (Stripe `mode: 'payment'`).
 */
export const PRICE_IDS = {
  plus_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY ?? '',
  plus_yearly: process.env.STRIPE_PRICE_PLUS_YEARLY ?? '',
  plus_quarterly: process.env.STRIPE_PRICE_PLUS_QUARTERLY ?? '',
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
  pro_quarterly: process.env.STRIPE_PRICE_PRO_QUARTERLY ?? '',
} as const;

export type PriceKey = keyof typeof PRICE_IDS;

/**
 * Map a Stripe price id back to (tier, interval). Used by the webhook
 * handler to translate a checkout.session.completed event into a tier
 * update. Returns null for unknown ids.
 */
export function resolvePriceId(
  priceId: string,
): { tier: 'plus' | 'pro'; interval: 'monthly' | 'yearly' | 'quarterly' } | null {
  for (const [key, id] of Object.entries(PRICE_IDS)) {
    if (id && id === priceId) {
      const [tier, interval] = key.split('_') as [
        'plus' | 'pro',
        'monthly' | 'yearly' | 'quarterly',
      ];
      return { tier, interval };
    }
  }
  return null;
}

/**
 * Verify a Stripe webhook signature. Throws on mismatch.
 * Always returns the parsed event — never trust the raw body without this.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Stripe API 2024+ moved `current_period_end` from the item to the
 * subscription itself. Older versions had it on the item. Read both
 * to be safe across SDK upgrades.
 *
 * Shared by the webhook handler and any direct API call (e.g. a
 * subscriptions.update() for an in-place plan change) that needs to
 * persist the same period-end shape.
 */
export function getPeriodEndUnix(sub: Stripe.Subscription): number | null {
  // SDK shape moves between versions — read both spots safely via index access.
  const subRecord = sub as unknown as Record<string, unknown>;
  const topLevel = subRecord['current_period_end'];
  if (typeof topLevel === 'number') return topLevel;
  const itemRecord = sub.items.data[0] as unknown as Record<string, unknown> | undefined;
  const item = itemRecord?.['current_period_end'];
  return typeof item === 'number' ? item : null;
}

/** Map a Stripe subscription status to our internal status enum. */
export function mapStripeStatus(
  s: Stripe.Subscription.Status,
): 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' {
  switch (s) {
    case 'active':
    case 'trialing':
      return s;
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'incomplete';
  }
}
