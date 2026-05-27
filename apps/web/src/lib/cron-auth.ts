/**
 * Shared cron route authentication.
 *
 * Constant-time bearer comparison against env.CRON_SECRET. Returns
 * NextResponse.json(...) for unauthorized callers so the route can
 * just `if (resp) return resp;` and proceed.
 *
 * String `!==` short-circuits on first mismatched byte, leaking
 * length and prefix to a timing oracle. Use timingSafeEqual instead.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  // Pre-check length to avoid timingSafeEqual throwing on unequal-length
  // buffers (which itself is a timing signal — refuse early).
  if (authHeader.length !== expected.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
