/**
 * GET    /api/resumes/[id]  — fetch a single resume
 * PATCH  /api/resumes/[id]  — update title or content
 * DELETE /api/resumes/[id]  — soft delete
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ResumeSchema } from '@resumaker/shared';
import { auditEvent } from '@/lib/audit';

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

  // If content is changing, snapshot the previous version FIRST
  if (body.content) {
    const [latest] = await db
      .select({ version: schema.resumeVersions.versionNumber })
      .from(schema.resumeVersions)
      .where(eq(schema.resumeVersions.resumeId, id))
      .orderBy(desc(schema.resumeVersions.versionNumber))
      .limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;
    await db.insert(schema.resumeVersions).values({
      resumeId: id,
      versionNumber: nextVersion,
      content: existing.content,
      title: existing.title,
    });
  }

  const patchResult = await db
    .update(schema.resumes)
    .set({
      ...(body.title ? { title: body.title } : {}),
      ...(body.content ? { content: body.content, locale: body.content.metadata.language } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.resumes.id, id),
        eq(schema.resumes.userId, session.user.id),
        isNull(schema.resumes.deletedAt),
      ),
    )
    .returning({ id: schema.resumes.id });
  if (patchResult.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  auditEvent({
    userId: session.user.id,
    event: 'resume_updated',
    metadata: { resumeId: id, contentChanged: Boolean(body.content) },
  });

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

  const deleteResult = await db
    .update(schema.resumes)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(schema.resumes.id, id),
        eq(schema.resumes.userId, session.user.id),
        isNull(schema.resumes.deletedAt),
      ),
    )
    .returning({ id: schema.resumes.id });
  if (deleteResult.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
