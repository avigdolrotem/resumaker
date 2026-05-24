/**
 * DELETE /api/account/sessions/[id] — revoke a single session.
 *
 * Refuses to revoke the caller's current session (use /sign-out instead).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  if (id === guard.session.session.id) {
    return NextResponse.json(
      { error: 'Use sign-out to end your current session' },
      { status: 400 },
    );
  }

  const existing = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, id), eq(schema.sessions.userId, guard.user.id)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(schema.sessions).where(eq(schema.sessions.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'sign_out',
    metadata: { kind: 'session_revoked', sessionId: id },
  });

  return NextResponse.json({ success: true });
}
