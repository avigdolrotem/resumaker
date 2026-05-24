/**
 * POST /api/account/password — change password.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Uses Better Auth's `changePassword` endpoint via the server-side API.
 * Requires the user to know their current password (defense against
 * stolen-cookie attacker rotating it). Better Auth handles the hash
 * verification and the new-hash storage; we just orchestrate + audit.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { auditEvent } from '@/lib/audit';
import { requireFreshSession } from '@/lib/auth-guards';

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'New password must be at least 12 characters').max(256),
});

export async function POST(req: NextRequest): Promise<Response> {
  // Fresh-session gate even though Better Auth verifies currentPassword:
  // defense-in-depth against credential stuffing. If an attacker has the
  // user's password from another breach AND a stolen cookie, they can
  // rotate the password without ever re-authenticating. The 15-min
  // freshness gate forces them through Better Auth's sign-in flow first,
  // which is rate-limited (5/min) and gets the user a sign-in audit row.
  const guard = await requireFreshSession(await headers(), 15 * 60);
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

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (err) {
    // Better Auth throws on wrong current password — surface as 401 so
    // the client can show "wrong current password" cleanly.
    const msg = (err as Error).message;
    auditEvent({
      userId: guard.user.id,
      event: 'password_changed',
      metadata: { success: false, reason: msg },
    });
    return NextResponse.json({ error: 'Could not change password', detail: msg }, { status: 401 });
  }

  auditEvent({
    userId: guard.user.id,
    event: 'password_changed',
    metadata: { success: true, otherSessionsRevoked: true },
  });

  return NextResponse.json({ success: true });
}
