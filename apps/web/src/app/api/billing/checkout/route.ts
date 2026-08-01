/**
 * POST /api/billing/checkout — start a payment provider checkout session,
 * OR change plan in place if the user already has a live subscription.
 *
 * Provider-agnostic: dispatches via `lib/billing/provider`. When the
 * caller has no existing recurring subscription, returns a URL to
 * redirect to (Stripe/LS-hosted checkout). When they already have one,
 * `purchaseOrChangePlan` swaps it in place with proration instead of
 * starting a second, independent subscription — see the doc comment on
 * that function for why a plain new-checkout would double-bill.
 * Returns 503 when no provider is configured.
 *
 * Body: { priceKey: 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly' }
 * Returns: { url: string } for a new checkout, or { changed: true } when
 * an existing subscription was updated in place (nothing to redirect to).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { env } from '@/lib/env';
import { purchaseOrChangePlan, getActiveProvider } from '@/lib/billing/provider';
import { validateCoupon } from '@/lib/billing/coupons';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';

const BodySchema = z.object({
  couponCode: z.string().max(40).optional(),
  priceKey: z.enum([
    'plus_monthly',
    'plus_yearly',
    'plus_quarterly',
    'pro_monthly',
    'pro_yearly',
    'pro_quarterly',
  ]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Stripe substitutes {CHECKOUT_SESSION_ID} server-side. LemonSqueezy
  // does NOT, so omit the placeholder when LS is active to avoid a
  // literal `?session_id={CHECKOUT_SESSION_ID}` in the redirect URL.
  const provider = getActiveProvider();
  const successUrl =
    provider === 'stripe'
      ? `${env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`
      : `${env.APP_URL}/billing/success`;

  // Pass locale so LS receipt button etc. render in the user's language.
  const rawLocale = await getLocale();
  const locale: 'he' | 'en' = rawLocale === 'he' ? 'he' : 'en';

  // Validate the code before creating the checkout. LemonSqueezy also
  // enforces expiry/redemption caps on its own discount, so this is the
  // friendly-error layer rather than the only line of defence — but it's
  // what stops a user reaching a payment page with a code that will be
  // silently ignored.
  let coupon: { id: string; code: string } | undefined;
  if (body.couponCode?.trim()) {
    const check = await validateCoupon(body.couponCode, guard.user.id);
    if (!check.ok) {
      return NextResponse.json(
        { error: 'Coupon not valid', code: 'COUPON_INVALID', reason: check.reason },
        { status: 422 },
      );
    }
    coupon = { id: check.couponId, code: check.code };
  }

  const result = await purchaseOrChangePlan({
    userId: guard.user.id,
    userEmail: guard.user.email,
    ...(coupon ? { coupon } : {}),
    priceKey: body.priceKey,
    successUrl,
    cancelUrl: `${env.APP_URL}/pricing?canceled=1`,
    locale,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.code, number> = {
      DISABLED: 503,
      NO_SUBSCRIPTION: 404,
      PRICE_MISSING: 500,
      PROVIDER_ERROR: 502,
    };
    logger.error(
      { code: result.code, userId: guard.user.id, message: result.message },
      'billing.checkout.failed',
    );
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: statusByCode[result.code] },
    );
  }

  if (result.mode === 'changed') {
    auditEvent({
      userId: guard.user.id,
      event: 'billing_checkout_started',
      metadata: { priceKey: body.priceKey, changedInPlace: true },
    });
    return NextResponse.json({ changed: true });
  }

  auditEvent({
    userId: guard.user.id,
    event: 'billing_checkout_started',
    metadata: { priceKey: body.priceKey, ...(coupon ? { couponCode: coupon.code } : {}) },
  });

  return NextResponse.json({ url: result.url });
}
