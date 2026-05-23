/**
 * POST /api/billing/portal — open the active provider's customer portal.
 *
 * Provider-agnostic — works for Stripe and LemonSqueezy. Even if the
 * global provider was switched, the user's own subscription row remembers
 * which provider it originated from and the portal opens correctly.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { openCustomerPortal } from '@/lib/billing/provider';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await openCustomerPortal({
    userId: session.user.id,
    returnUrl: `${env.APP_URL}/account/billing`,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.code, number> = {
      DISABLED: 503,
      NO_CUSTOMER: 404,
      PROVIDER_ERROR: 502,
    };
    logger.error(
      { code: result.code, userId: session.user.id, message: result.message },
      'billing.portal.failed',
    );
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: statusByCode[result.code] },
    );
  }

  auditEvent({
    userId: session.user.id,
    event: 'billing_portal_opened',
  });

  return NextResponse.json({ url: result.url });
}
