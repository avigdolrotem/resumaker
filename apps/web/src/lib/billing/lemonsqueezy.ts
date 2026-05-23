/**
 * LemonSqueezy client wrapper.
 *
 * LS is a Merchant of Record — they handle VAT, invoicing, and tax in
 * every country. Higher per-txn fee (~5%) than Stripe (2.9%) but
 * **zero setup cost** and no Israeli business number required.
 *
 * Dormant until `PAYMENT_PROVIDER='lemonsqueezy'` and the env vars
 * below are set. Safe to import unconditionally.
 *
 * Wire-up steps:
 *   1. Sign up at https://lemonsqueezy.com (free, no setup fee)
 *   2. Create a store, add products with variants:
 *      - Pro (monthly) → ₪39
 *      - Pro (yearly)  → ₪390
 *      - Premium (monthly) → ₪99
 *      - Premium (yearly)  → ₪990
 *   3. Settings → API → create an API key, paste as LEMONSQUEEZY_API_KEY
 *   4. Note your store id → LEMONSQUEEZY_STORE_ID
 *   5. Settings → Webhooks → add endpoint `https://resumaker.co.il/api/billing/webhook/lemonsqueezy`,
 *      enable all `subscription_*` events + `order_created`, copy signing secret → LEMONSQUEEZY_WEBHOOK_SECRET
 *   6. Copy each variant id from the dashboard → LEMONSQUEEZY_VARIANT_*
 *   7. Set PAYMENT_PROVIDER=lemonsqueezy
 */

import { createHmac, timingSafeEqual } from 'crypto';
import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  getCustomer,
} from '@lemonsqueezy/lemonsqueezy.js';
import { env } from '@/lib/env';

let initialized = false;

/**
 * Lazy initializer. Throws if called without an API key — callers should
 * gate this behind `env.PAYMENT_PROVIDER === 'lemonsqueezy'` first.
 */
export function ensureLemonSqueezy(): void {
  if (initialized) return;
  if (!env.LEMONSQUEEZY_API_KEY) {
    throw new Error(
      'LemonSqueezy is not configured. Set LEMONSQUEEZY_API_KEY and PAYMENT_PROVIDER=lemonsqueezy.',
    );
  }
  lemonSqueezySetup({
    apiKey: env.LEMONSQUEEZY_API_KEY,
    onError: (err) => {
      console.error('[lemonsqueezy] api error', err);
    },
  });
  initialized = true;
}

/**
 * Map our internal price keys to LemonSqueezy variant ids from env.
 * Each LS product can have multiple variants (monthly/yearly/quarterly).
 *
 * `_quarterly` is the 3-month one-time "Job Hunt Pack" — modeled as a
 * one-time product in LS (no recurring billing). The webhook handler
 * detects `order_created` (vs `subscription_created`) to grant a
 * 90-day tier expiry instead of an ongoing subscription.
 */
export type LsPriceKey =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'plus_quarterly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'pro_quarterly';

export function getVariantId(key: LsPriceKey): string | null {
  switch (key) {
    case 'plus_monthly':
      return env.LEMONSQUEEZY_VARIANT_PLUS_MONTHLY ?? null;
    case 'plus_yearly':
      return env.LEMONSQUEEZY_VARIANT_PLUS_YEARLY ?? null;
    case 'plus_quarterly':
      return env.LEMONSQUEEZY_VARIANT_PLUS_QUARTERLY ?? null;
    case 'pro_monthly':
      return env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY ?? null;
    case 'pro_yearly':
      return env.LEMONSQUEEZY_VARIANT_PRO_YEARLY ?? null;
    case 'pro_quarterly':
      return env.LEMONSQUEEZY_VARIANT_PRO_QUARTERLY ?? null;
  }
}

/**
 * Reverse-map a LemonSqueezy variant id back to (tier, interval).
 * Used by the webhook handler to translate a subscription event into a
 * tier update on the user.
 */
export function resolveVariantId(
  variantId: string,
): { tier: 'plus' | 'pro'; interval: 'monthly' | 'yearly' | 'quarterly' } | null {
  const keys: LsPriceKey[] = [
    'plus_monthly',
    'plus_yearly',
    'plus_quarterly',
    'pro_monthly',
    'pro_yearly',
    'pro_quarterly',
  ];
  for (const key of keys) {
    if (getVariantId(key) === variantId) {
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
 * Create a LemonSqueezy Checkout session and return the redirect URL.
 *
 * `userId` is round-tripped via `custom.user_id` so the webhook handler
 * can map the resulting subscription back to our user row.
 */
export async function createCheckoutUrl(args: {
  variantId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  /** UI locale of the buyer — controls receipt-button copy. */
  locale?: 'he' | 'en';
}): Promise<string> {
  ensureLemonSqueezy();
  if (!env.LEMONSQUEEZY_STORE_ID) {
    throw new Error('LEMONSQUEEZY_STORE_ID is not set');
  }

  const receiptButton = args.locale === 'he' ? 'חזרה לאזור האישי' : 'Back to dashboard';

  const { data, error } = await createCheckout(env.LEMONSQUEEZY_STORE_ID, args.variantId, {
    checkoutData: {
      email: args.userEmail,
      custom: {
        user_id: args.userId,
      },
    },
    productOptions: {
      redirectUrl: args.successUrl,
      receiptButtonText: receiptButton,
      receiptLinkUrl: args.successUrl,
    },
    checkoutOptions: {
      embed: false,
      media: false,
      logo: true,
      dark: false,
    },
  });

  if (error) {
    throw new Error(`LemonSqueezy createCheckout failed: ${error.message}`);
  }
  const url = data?.data.attributes.url;
  if (!url) throw new Error('LemonSqueezy returned no checkout URL');
  return url;
}

/**
 * Fetch a fresh customer portal URL for a given subscription. LS includes
 * one in the subscription object but it can expire — re-fetching is safest
 * for the click-through flow.
 */
export async function getPortalUrl(subscriptionId: string): Promise<string | null> {
  ensureLemonSqueezy();
  const { data, error } = await getSubscription(subscriptionId);
  if (error || !data) return null;
  return data.data.attributes.urls.customer_portal ?? null;
}

/**
 * Get the customer-portal-update URL keyed by LS customer id (works even
 * if the user has multiple subscriptions).
 */
export async function getCustomerPortalUrl(customerId: string): Promise<string | null> {
  ensureLemonSqueezy();
  const { data, error } = await getCustomer(customerId);
  if (error || !data) return null;
  // LS customer object has urls.customer_portal too
  const urls = data.data.attributes.urls as { customer_portal?: string } | undefined;
  return urls?.customer_portal ?? null;
}

/**
 * Verify a LemonSqueezy webhook signature. LS sends the signature in the
 * `X-Signature` header as a hex HMAC-SHA256 of the raw body keyed by the
 * webhook secret.
 *
 * Returns true if signature is valid. Constant-time comparison via
 * timingSafeEqual to avoid signature-timing attacks.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET is not set');
  }
  const expected = createHmac('sha256', env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  // Both buffers must be the same length for timingSafeEqual
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Map LS subscription status to our internal status enum.
 * LS docs: https://docs.lemonsqueezy.com/api/subscriptions#subscription-status
 */
export function mapLsStatus(
  s: string,
): 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' {
  switch (s) {
    case 'active':
      return 'active';
    case 'on_trial':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'cancelled':
    case 'expired':
      return 'canceled';
    case 'paused':
    case 'unpaid':
      return 'past_due';
    default:
      return 'incomplete';
  }
}
