/**
 * PATCH  /api/saved-searches/[id] — update name / query / frequency
 * DELETE /api/saved-searches/[id]
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

const Patch = z.object({
  name: z.string().min(1).max(100).optional(),
  alertFrequency: z.enum(['daily', 'weekly', 'off']).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const existing = await db.query.savedSearches.findFirst({
    where: and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, guard.user.id)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: z.infer<typeof Patch>;
  try {
    body = Patch.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates['name'] = body.name;
  if (body.alertFrequency !== undefined) updates['alertFrequency'] = body.alertFrequency;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db
    .update(schema.savedSearches)
    .set(updates)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, guard.user.id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const existing = await db.query.savedSearches.findFirst({
    where: and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, guard.user.id)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .delete(schema.savedSearches)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, guard.user.id)));
  return NextResponse.json({ success: true });
}
