/**
 * GET /api/account/email-change/confirm?token=...
 *
 * Completes the email-change flow. Validates the token, swaps users.email,
 * marks emailVerified=true (the user just proved control), deletes the
 * request row, and audits.
 *
 * Public endpoint (no session) — the user might be confirming from a
 * different device. The token is the only auth.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?email-change=missing-token', req.url));
  }

  const request = await db.query.emailChangeRequests.findFirst({
    where: eq(schema.emailChangeRequests.token, token),
  });
  if (!request) {
    return NextResponse.redirect(new URL('/?email-change=invalid', req.url));
  }

  if (request.expiresAt < new Date()) {
    await db
      .delete(schema.emailChangeRequests)
      .where(eq(schema.emailChangeRequests.id, request.id));
    return NextResponse.redirect(new URL('/?email-change=expired', req.url));
  }

  // Race check — another user might have signed up with this email in the
  // window between request and confirm.
  const conflict = await db.query.users.findFirst({
    where: eq(schema.users.email, request.newEmail),
    columns: { id: true },
  });
  if (conflict && conflict.id !== request.userId) {
    await db
      .delete(schema.emailChangeRequests)
      .where(eq(schema.emailChangeRequests.id, request.id));
    return NextResponse.redirect(new URL('/?email-change=conflict', req.url));
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ email: request.newEmail, emailVerified: true, updatedAt: new Date() })
      .where(eq(schema.users.id, request.userId));
    await tx
      .delete(schema.emailChangeRequests)
      .where(eq(schema.emailChangeRequests.id, request.id));
  });

  auditEvent({
    userId: request.userId,
    event: 'profile_updated',
    metadata: { kind: 'email_changed', newEmail: request.newEmail },
  });

  // Redirect to dashboard with success flash
  return NextResponse.redirect(new URL('/dashboard?email-change=success', req.url));
}
