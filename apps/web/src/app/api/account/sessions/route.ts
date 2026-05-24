/**
 * GET /api/account/sessions — list active sessions for the current user.
 *
 * Returns id, createdAt, expiresAt, userAgent, hashed ipAddress. Current
 * session is flagged so the UI can disable its revoke button.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.sessions.findMany({
    where: eq(schema.sessions.userId, guard.user.id),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    columns: {
      id: true,
      createdAt: true,
      expiresAt: true,
      updatedAt: true,
      userAgent: true,
      ipAddress: true, // already HMAC-hashed by L1 session.create.before hook
    },
  });

  return NextResponse.json({
    sessions: rows.map((s) => ({
      ...s,
      isCurrent: s.id === guard.session.session.id,
    })),
  });
}
