/**
 * POST /api/support/contact — submit a support contact form.
 *
 * Both authenticated AND anonymous submissions are accepted. The latter
 * are rate-limited per-IP to thwart spam. Tickets are stored in DB +
 * relayed via Resend to support@resumaker.co.il.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { db, schema } from '@/db';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/email/client';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/observability';

const BodySchema = z.object({
  email: z.string().email().max(320),
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
});

export async function POST(req: NextRequest): Promise<Response> {
  // Rate-limit anonymous submissions per-IP. Authenticated users get
  // the same limit per-user — abuse is rare and not worth two tiers.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await checkRateLimit(`contact:${ip}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many contact requests — try again in an hour' },
      { status: 429 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Best-effort session read (anonymous submissions allowed)
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  const [row] = await db
    .insert(schema.supportTickets)
    .values({
      ...(session ? { userId: session.user.id } : {}),
      email: body.email,
      subject: body.subject,
      body: body.body,
    })
    .returning({ id: schema.supportTickets.id });

  // Relay to support inbox — fire-and-forget so a Resend hiccup doesn't
  // break the user's submission.
  void (async () => {
    try {
      await sendEmail({
        to: 'support@resumaker.co.il',
        subject: `[support] ${body.subject}`,
        html: `
          <p><strong>From:</strong> ${body.email}${session ? ` (user ${session.user.id.slice(0, 8)}…)` : ' (anonymous)'}</p>
          <p><strong>Ticket:</strong> ${row?.id ?? '?'}</p>
          <hr>
          <pre style="white-space:pre-wrap;font-family:inherit;">${body.body.replace(/</g, '&lt;')}</pre>
        `,
      });
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, ticketId: row?.id },
        'support.contact.email_relay_failed',
      );
    }
  })();

  return NextResponse.json({ success: true, ticketId: row?.id });
}
