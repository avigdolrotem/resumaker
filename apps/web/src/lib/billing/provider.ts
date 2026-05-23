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
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { getStripe, PRICE_IDS as STRIPE_PRICE_IDS } from './stripe';
import {
  createCheckoutUrl as lsCreateCheckoutUrl,
  getCustomerPortalUrl as lsGetCustomerPortalUrl,
  getPortalUrl as lsGetPortalUrl,
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
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
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
