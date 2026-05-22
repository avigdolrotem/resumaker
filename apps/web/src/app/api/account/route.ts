/**
 * DELETE /api/account
 *
 * Soft-delete the current user (GDPR-compliant: full delete after 30 days).
 * Sessions are immediately invalidated.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

export async function DELETE(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Soft-delete user, hard-delete sessions
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, userId));

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    // Log to audit
    await tx.insert(schema.auditLog).values({
      userId,
      event: 'account_deleted',
      metadata: { reason: 'user_requested' },
    });
  });

  return NextResponse.json({ success: true });
}
