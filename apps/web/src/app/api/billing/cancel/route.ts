/**
 * POST /api/billing/cancel — schedule (or undo) cancellation of the
 * caller's own subscription, effective at the end of the current paid
 * period. Never an immediate cutoff — see setSubscriptionCancellation's
 * doc comment for why (matches /terms Section 6's cancellation policy).
 *
 * Body: { resume?: boolean } — omit/false to schedule cancellation,
 * true to undo a previously-scheduled cancellation.
 * Returns: { ok: true }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { setSubscriptionCancellation } from '@/lib/billing/provider';
import { logger } from '@/lib/observability';
import { requireFreshSession } from '@/lib/auth-guards';

export const runtime = 'nodejs';

const BodySchema = z.object({ resume: z.boolean().optional().default(false) });

export async function POST(req: Request): Promise<Response> {
  // Re-auth gate, same as the portal/account-deletion routes — this
  // mutates billing state on a subscription that's actively charging
  // the customer, so a stolen old cookie shouldn't be able to touch it.
  const guard = await requireFreshSession(await headers(), 15 * 60);
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const result = await setSubscriptionCancellation({
    userId: guard.user.id,
    cancel: !body.resume,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.code, number> = {
      DISABLED: 503,
      NO_SUBSCRIPTION: 404,
      PROVIDER_ERROR: 502,
    };
    logger.error(
      { code: result.code, userId: guard.user.id, message: result.message },
      'billing.cancel.failed',
    );
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: statusByCode[result.code] },
    );
  }

  return NextResponse.json({ ok: true });
}
