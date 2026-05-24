/**
 * PATCH  /api/applications/[id] — update status / notes / contact fields
 * DELETE /api/applications/[id] — remove a tracked application
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

const APP_STATUSES = [
  'interested',
  'applied',
  'recruiter_screen',
  'tech_interview',
  'onsite',
  'offer',
  'rejected',
  'ghosted',
] as const;

const PatchBody = z.object({
  status: z.enum(APP_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notifyRecruiter: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const existing = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, guard.user.id)),
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Auto-stamp appliedAt when crossing into 'applied' (or beyond) the first time.
  const advancingToApplied = body.status && body.status !== 'interested' && !existing.appliedAt;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status !== undefined) updates['status'] = body.status;
  if (body.notes !== undefined) updates['notes'] = body.notes;
  if (body.contactName !== undefined) updates['contactName'] = body.contactName;
  if (body.contactEmail !== undefined) updates['contactEmail'] = body.contactEmail;
  if (body.nextActionAt !== undefined) {
    updates['nextActionAt'] = body.nextActionAt ? new Date(body.nextActionAt) : null;
  }
  if (body.notifyRecruiter !== undefined) updates['notifyRecruiter'] = body.notifyRecruiter;
  if (advancingToApplied) updates['appliedAt'] = new Date();

  await db.update(schema.applications).set(updates).where(eq(schema.applications.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const existing = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, guard.user.id)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(schema.applications).where(eq(schema.applications.id, id));
  return NextResponse.json({ success: true });
}
