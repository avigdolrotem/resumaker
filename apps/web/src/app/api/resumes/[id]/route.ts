/**
 * GET    /api/resumes/[id]  — fetch a single resume
 * PATCH  /api/resumes/[id]  — update title or content
 * DELETE /api/resumes/[id]  — soft delete
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ResumeSchema } from '@resumaker/shared';

async function getOwnedResume(
  resumeId: string,
  userId: string,
): Promise<typeof schema.resumes.$inferSelect | null> {
  const row = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, resumeId),
      eq(schema.resumes.userId, userId),
      isNull(schema.resumes.deletedAt),
    ),
  });
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const resume = await getOwnedResume(id, session.user.id);
  if (!resume) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ resume });
}

const PatchBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: ResumeSchema.optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedResume(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: z.infer<typeof PatchBodySchema>;
  try {
    body = PatchBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  await db
    .update(schema.resumes)
    .set({
      ...(body.title ? { title: body.title } : {}),
      ...(body.content ? { content: body.content, locale: body.content.metadata.language } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.resumes.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedResume(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.update(schema.resumes).set({ deletedAt: new Date() }).where(eq(schema.resumes.id, id));

  return NextResponse.json({ success: true });
}
