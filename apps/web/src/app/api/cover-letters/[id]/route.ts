/**
 * GET    /api/cover-letters/[id]   — fetch one
 * DELETE /api/cover-letters/[id]   — soft delete
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const letter = await getOwnedLetter(id, session.user.id);
  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(letter);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedLetter(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .update(schema.coverLetters)
    .set({ deletedAt: new Date() })
    .where(eq(schema.coverLetters.id, id));

  auditEvent({
    userId: session.user.id,
    event: 'resume_deleted',
    metadata: { kind: 'cover_letter', id },
  });

  return NextResponse.json({ success: true });
}
