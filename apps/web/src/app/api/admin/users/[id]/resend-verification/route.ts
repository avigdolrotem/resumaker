/**
 * POST /api/admin/users/[id]/resend-verification
 *
 * Admin-only. Triggers Better Auth's `sendVerificationEmail` for the
 * target user. Useful when an OAuth user lost the original email or
 * the auto-send bounced.
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
    columns: { email: true, emailVerified: true },
  });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.emailVerified) {
    return NextResponse.json({ error: 'Already verified' }, { status: 400 });
  }

  try {
    await auth.api.sendVerificationEmail({
      body: { email: target.email },
      headers: await headers(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not send', detail: (err as Error).message },
      { status: 502 },
    );
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'resend_verification', targetUserId: id },
  });

  return NextResponse.json({ success: true });
}
