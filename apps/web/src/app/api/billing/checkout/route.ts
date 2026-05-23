/**
 * POST /api/billing/checkout — start a payment provider checkout session.
 *
 * Provider-agnostic: dispatches via `lib/billing/provider`. Returns a
 * URL the client redirects to. Returns 503 when no provider is configured.
 *
 * Body: { priceKey: 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly' }
 * Returns: { url: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { startCheckout, getActiveProvider } from '@/lib/billing/provider';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';

const BodySchema = z.object({
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const result = await startCheckout({
    userId: session.user.id,
    userEmail: session.user.email,
    priceKey: body.priceKey,
    successUrl,
    cancelUrl: `${env.APP_URL}/pricing?canceled=1`,
    locale,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.code, number> = {
      DISABLED: 503,
      PRICE_MISSING: 500,
      PROVIDER_ERROR: 502,
    };
    logger.error(
      { code: result.code, userId: session.user.id, message: result.message },
      'billing.checkout.failed',
    );
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: statusByCode[result.code] },
    );
  }

  auditEvent({
    userId: session.user.id,
    event: 'billing_checkout_started',
    metadata: { priceKey: body.priceKey },
  });

  return NextResponse.json({ url: result.url });
}
