/**
 * POST /api/account/email-change/request
 *
 * Body: { newEmail: string, currentPassword: string }
 *
 * Stores a pending email-change request with a 1h token + emails the
 * verification link to the NEW address. The swap doesn't happen until
 * /confirm is hit (proves the user controls the new mailbox).
 *
 * Requires current password — prevents a stolen-session attacker from
 * pivoting account ownership to their own mailbox.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';
import { sendEmail } from '@/lib/email/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

const BodySchema = z.object({
  newEmail: z.string().email().max(320),
  currentPassword: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
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

  if (body.newEmail.toLowerCase() === guard.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'New email matches your current email' }, { status: 400 });
  }

  // Re-verify password via Better Auth signIn dry-run — it throws on bad
  // password. This is the cheapest way without exposing the hash.
  try {
    await auth.api.signInEmail({
      body: { email: guard.user.email, password: body.currentPassword },
      headers: await headers(),
    });
  } catch {
    return NextResponse.json({ error: 'Wrong current password' }, { status: 401 });
  }

  // Check that new email isn't already taken — return a neutral response
  // to prevent email enumeration by authenticated users.
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, body.newEmail.toLowerCase()),
    columns: { id: true },
  });
  if (existing) {
    // Don't echo the target email — observability scrubber keys on
    // standard `email` field name; using a custom key bypasses the
    // scrub and leaks it to Sentry / Cloud Logging.
    logger.warn(
      { userId: guard.user.id },
      'email_change.request.conflict: target address already registered',
    );
    return NextResponse.json({
      success: true,
      message:
        "If that address isn't already linked to an account, you'll receive a verification email shortly.",
    });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await db.insert(schema.emailChangeRequests).values({
    userId: guard.user.id,
    newEmail: body.newEmail.toLowerCase(),
    token,
    expiresAt,
  });

  // Email the verification link to the NEW address (not the current one —
  // current owner doesn't need to re-confirm; new owner must prove control).
  const url = `${env.APP_URL}/${guard.user.locale ?? 'he'}/account/email-change/confirm?token=${token}`;
  await sendEmail({
    to: body.newEmail,
    subject:
      guard.user.locale === 'en'
        ? 'Confirm your new Resumaker email'
        : 'אשר את כתובת המייל החדשה שלך ב-Resumaker',
    html:
      guard.user.locale === 'en'
        ? `<p>Click below to confirm this is your new email. Link expires in 1 hour.</p><p><a href="${url}">${url}</a></p>`
        : `<p>לחץ כדי לאשר שזו כתובת המייל החדשה שלך. הקישור תקף לשעה.</p><p><a href="${url}">${url}</a></p>`,
  });

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'email_change_requested', expiresAt: expiresAt.toISOString() },
  });

  return NextResponse.json({
    success: true,
    message:
      "If that address isn't already linked to an account, you'll receive a verification email shortly.",
  });
}
