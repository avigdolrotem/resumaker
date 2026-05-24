/**
 * POST /api/billing/portal — open the active provider's customer portal.
 *
 * Provider-agnostic — works for Stripe and LemonSqueezy. Even if the
 * global provider was switched, the user's own subscription row remembers
 * which provider it originated from and the portal opens correctly.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { openCustomerPortal } from '@/lib/billing/provider';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';
import { requireFreshSession } from '@/lib/auth-guards';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  // Re-auth gate: the billing portal lets a user cancel, swap plans, and
  // see card details. A stolen old cookie shouldn't grant that access.
  const guard = await requireFreshSession(await headers(), 15 * 60);
  if (guard instanceof NextResponse) return guard;

  const result = await openCustomerPortal({
    userId: guard.user.id,
    returnUrl: `${env.APP_URL}/account/billing`,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.code, number> = {
      DISABLED: 503,
      NO_CUSTOMER: 404,
      PROVIDER_ERROR: 502,
    };
    logger.error(
      { code: result.code, userId: guard.user.id, message: result.message },
      'billing.portal.failed',
    );
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: statusByCode[result.code] },
    );
  }

  auditEvent({
    userId: guard.user.id,
    event: 'billing_portal_opened',
  });

  return NextResponse.json({ url: result.url });
}
