/**
 * POST /api/billing/coupon — check a coupon code before checkout.
 *
 * Read-only: validating is not redeeming. The redemption is recorded by
 * the billing webhook once payment actually completes (see
 * lib/billing/coupons.ts's recordCouponRedemption), because a user who
 * reaches the payment page and abandons it hasn't used anything.
 *
 * Exists so the upgrade UI can say "20% off applied" — or why not —
 * before sending someone to a payment page. POST rather than GET so the
 * code isn't left in browser history or server access logs.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { requireActiveUser } from '@/lib/auth-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCoupon } from '@/lib/billing/coupons';

const BodySchema = z.object({ code: z.string().min(1).max(40) });

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  // An unauthenticated-feeling oracle: without a limit this endpoint
  // lets someone brute-force the coupon namespace to find live codes.
  const rl = await checkRateLimit(`coupon-check:${guard.user.id}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts — try again later', retryAfterSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const result = await validateCoupon(body.code, guard.user.id);
  if (!result.ok) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }

  return NextResponse.json({
    valid: true,
    code: result.code,
    discountPercent: result.discountPercent,
  });
}
