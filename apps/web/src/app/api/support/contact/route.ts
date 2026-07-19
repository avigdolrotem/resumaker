/**
 * POST /api/support/contact — submit a support contact form.
 *
 * Both authenticated AND anonymous submissions are accepted. The latter
 * are rate-limited per-IP to thwart spam. Tickets are stored in DB +
 * relayed via Resend to support@resumaker.co.il.
 */

import { NextResponse, type NextRequest, after } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { db, schema } from '@/db';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/email/client';
import { escapeHtml } from '@/lib/email/templates';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractClientIp } from '@/lib/ip';
import { logger } from '@/lib/observability';
import { hashIp } from '@/lib/audit';

const BodySchema = z.object({
  email: z.string().email().max(320),
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
});

export async function POST(req: NextRequest): Promise<Response> {
  // Rate-limit anonymous submissions per-IP. Authenticated users get
  // the same limit per-user — abuse is rare and not worth two tiers.
  // extractClientIp uses the rightmost public IP from x-forwarded-for
  // so a spoofed leftmost entry can't bypass the limit.
  const ip = extractClientIp(req);
  // Hashed, not raw — see the matching comment in tools/ats-scanner/route.ts.
  const rl = await checkRateLimit(`contact:${hashIp(ip) ?? ip}`, 5, 3600);
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

  // Relay to support inbox. Use Next's `after()` so the send completes
  // before Vercel freezes the function (a bare `void IIFE` can be reaped
  // mid-flight). Every user-supplied value goes through escapeHtml so
  // the support inbox can't be XSS'd via a crafted email/subject/body.
  after(async () => {
    try {
      const result = await sendEmail({
        to: 'support@resumaker.co.il',
        subject: `[support] ${body.subject}`,
        html: `
          <p><strong>From:</strong> ${escapeHtml(body.email)}${session ? ` (user ${escapeHtml(session.user.id.slice(0, 8))}…)` : ' (anonymous)'}</p>
          <p><strong>Ticket:</strong> ${escapeHtml(row?.id ?? '?')}</p>
          <hr>
          <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(body.body)}</pre>
        `,
      });
      if (!result.ok) {
        logger.warn({ err: result.error, ticketId: row?.id }, 'support.contact.email_relay_failed');
      }
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, ticketId: row?.id },
        'support.contact.email_relay_failed',
      );
    }
  });

  return NextResponse.json({ success: true, ticketId: row?.id });
}
