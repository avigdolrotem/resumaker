/**
 * POST /api/admin/users/[id]/impersonate
 *
 * Creates a new Better Auth session for the target user with impersonation
 * metadata, records the impersonation_sessions row, and returns a session cookie.
 *
 * POST /api/admin/users/[id]/impersonate/exit
 * Not a named route here — handled via query param ?exit=1.
 * The client can also POST ?exit=1 to end the impersonation session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id: targetUserId } = await params;

  const exit = req.nextUrl.searchParams.get('exit') === '1';

  if (exit) {
    // End impersonation: mark all impersonation_sessions for this pair
    await db
      .update(schema.impersonationSessions)
      .set({ endedAt: new Date() })
      .where(eq(schema.impersonationSessions.adminUserId, guard.user.id));

    auditEvent({
      userId: guard.user.id,
      event: 'admin_action',
      metadata: { kind: 'impersonation_exit', targetUserId },
    });

    return NextResponse.json({ success: true });
  }

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, targetUserId),
    columns: { id: true, email: true, name: true, role: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Prevent impersonating another admin
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Cannot impersonate admin users' }, { status: 403 });
  }

  // Create a session row for the target user with impersonation metadata
  const sessionToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 4); // 4h

  await db.insert(schema.sessions).values({
    id: randomBytes(16).toString('hex'),
    userId: targetUserId,
    token: sessionToken,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Record the impersonation session
  await db.insert(schema.impersonationSessions).values({
    adminUserId: guard.user.id,
    targetUserId,
  });

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'impersonation_start', targetUserId, targetEmail: target.email },
  });

  const res = NextResponse.json({
    success: true,
    sessionToken,
    targetUserId,
    expiresAt: expiresAt.toISOString(),
    impersonatedBy: guard.user.id,
  });

  // Set session cookie for the impersonated user
  res.cookies.set('better-auth.session_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return res;
}
