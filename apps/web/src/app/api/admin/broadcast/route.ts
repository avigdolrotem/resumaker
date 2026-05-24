/**
 * GET  /api/admin/broadcast        — list broadcast emails
 * POST /api/admin/broadcast        — create draft
 * POST /api/admin/broadcast?send=1 — send draft by id in body
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';
import { sendEmail } from '@/lib/email/client';

const CreateSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  locale: z.string().max(8).default('he'),
});

const SendSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.broadcastEmails.findMany({
    orderBy: [desc(schema.broadcastEmails.createdAt)],
    limit: 100,
  });

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const send = req.nextUrl.searchParams.get('send') === '1';

  if (send) {
    let body: z.infer<typeof SendSchema>;
    try {
      body = SendSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: 'Invalid body', detail: (err as Error).message }, { status: 400 });
    }

    const broadcast = await db.query.broadcastEmails.findFirst({
      where: eq(schema.broadcastEmails.id, body.id),
    });
    if (!broadcast) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (broadcast.status !== 'draft') {
      return NextResponse.json({ error: 'Already sent' }, { status: 400 });
    }

    // Find eligible users: marketingOptIn=true, locale matches
    const users = await db.query.users.findMany({
      where: eq(schema.users.marketingOptIn, true),
      columns: { id: true, email: true, locale: true },
    });
    const recipients = users.filter((u) => u.locale === broadcast.locale);

    let sent = 0;
    for (const user of recipients) {
      const result = await sendEmail({
        to: user.email,
        subject: broadcast.subject,
        html: `<div>${broadcast.body}</div>`,
        text: broadcast.body,
      });
      if (result.ok) sent++;
    }

    await db
      .update(schema.broadcastEmails)
      .set({
        status: 'sent',
        sentAt: new Date(),
        sentBy: guard.user.id,
        recipientCount: sent,
      })
      .where(eq(schema.broadcastEmails.id, body.id));

    auditEvent({
      userId: guard.user.id,
      event: 'admin_action',
      metadata: { kind: 'broadcast_sent', broadcastId: body.id, recipientCount: sent },
    });

    return NextResponse.json({ success: true, recipientCount: sent });
  }

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body', detail: (err as Error).message }, { status: 400 });
  }

  const rows = await db
    .insert(schema.broadcastEmails)
    .values({
      subject: body.subject,
      body: body.body,
      locale: body.locale,
      sentBy: guard.user.id,
      status: 'draft',
    })
    .returning();

  const insertedRow = rows[0];
  if (!insertedRow) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'broadcast_created', broadcastId: insertedRow.id },
  });

  return NextResponse.json({ row: insertedRow }, { status: 201 });
}
