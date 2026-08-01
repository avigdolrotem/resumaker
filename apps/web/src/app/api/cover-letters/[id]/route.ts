/**
 * GET    /api/cover-letters/[id]   — fetch one
 * DELETE /api/cover-letters/[id]   — soft delete
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

async function getOwnedLetter(id: string, userId: string) {
  return db.query.coverLetters.findFirst({
    where: and(
      eq(schema.coverLetters.id, id),
      eq(schema.coverLetters.userId, userId),
      isNull(schema.coverLetters.deletedAt),
    ),
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const letter = await getOwnedLetter(id, guard.user.id);
  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(letter);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const existing = await getOwnedLetter(id, guard.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Re-assert ownership in the WHERE clause — TOCTOU defense.
  await db
    .update(schema.coverLetters)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.coverLetters.id, id), eq(schema.coverLetters.userId, guard.user.id)));

  auditEvent({
    userId: guard.user.id,
    event: 'resume_deleted',
    metadata: { kind: 'cover_letter', id },
  });

  return NextResponse.json({ success: true });
}
