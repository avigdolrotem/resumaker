/**
 * GET /api/account/email-change/confirm?token=...
 *
 * Completes the email-change flow. Validates the token, swaps users.email,
 * marks emailVerified=true (the user just proved control), deletes the
 * request row, and audits.
 *
 * Public endpoint (no session) — the user might be confirming from a
 * different device. The token is the only auth.
 *
 * All outcomes redirect to /{locale}/dashboard?email-change=<outcome> —
 * a client-side toast on that page reads the param and shows the result
 * (see EmailChangeStatusToast). Previously failure paths redirected to
 * bare `/`, which (a) dropped the locale prefix and (b) got the query
 * param silently discarded for signed-in users, since the homepage's
 * signed-in redirect to /dashboard doesn't forward search params —
 * so every failure mode (expired/invalid/conflict/missing-token) was
 * completely invisible to the user. Note this still dead-ends at a
 * context-free /sign-in for the "confirming from a device you're not
 * logged in on" case — that's a pre-existing gap in the (app) layout's
 * auth guard (no callbackURL preservation on ANY protected route, not
 * specific to this flow) and out of scope here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

function outcomeRedirect(req: NextRequest, locale: string, outcome: string): NextResponse {
  return NextResponse.redirect(new URL(`/${locale}/dashboard?email-change=${outcome}`, req.url));
}

export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return outcomeRedirect(req, 'he', 'missing-token');
  }

  const request = await db.query.emailChangeRequests.findFirst({
    where: eq(schema.emailChangeRequests.token, token),
  });
  if (!request) {
    return outcomeRedirect(req, 'he', 'invalid');
  }

  const requester = await db.query.users.findFirst({
    where: eq(schema.users.id, request.userId),
    columns: { locale: true },
  });
  const locale = requester?.locale === 'en' ? 'en' : 'he';

  if (request.expiresAt < new Date()) {
    await db
      .delete(schema.emailChangeRequests)
      .where(eq(schema.emailChangeRequests.id, request.id));
    return outcomeRedirect(req, locale, 'expired');
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
    return outcomeRedirect(req, locale, 'conflict');
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

  return outcomeRedirect(req, locale, 'success');
}
