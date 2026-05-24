/**
 * POST /api/admin/users/[id]/force-password-reset
 *
 * Admin-only. Triggers a password-reset email for the target user AND
 * revokes all of their current sessions (so they're forced to use the
 * reset flow).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { email: true },
  });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Revoke all sessions first so any active attacker is bounced
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));

  try {
    // Better Auth uses `requestPasswordReset` in some versions and the
    // legacy `forgetPassword` in others. Cast through unknown so the
    // forgiving runtime accepts either; if neither exists this throws
    // and we surface as 502 below.
    const api = auth.api as unknown as {
      requestPasswordReset?: (opts: {
        body: { email: string; redirectTo?: string };
        headers: Headers;
      }) => Promise<unknown>;
      forgetPassword?: (opts: {
        body: { email: string; redirectTo?: string };
        headers: Headers;
      }) => Promise<unknown>;
    };
    const fn = api.requestPasswordReset ?? api.forgetPassword;
    if (!fn) throw new Error('Better Auth password-reset API not available');
    await fn({
      body: { email: target.email, redirectTo: '/reset-password' },
      headers: await headers(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not trigger reset', detail: (err as Error).message },
      { status: 502 },
    );
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'force_password_reset', targetUserId: id, sessionsRevoked: true },
  });

  return NextResponse.json({ success: true });
}
