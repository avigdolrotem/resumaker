/**
 * GET  /api/resumes/[id]/versions  — list past versions (newest first)
 * POST /api/resumes/[id]/versions  — restore a version (body: { versionNumber: number })
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ResumeSchema } from '@resumaker/shared';
import { auditEvent } from '@/lib/audit';

async function ownsResume(resumeId: string, userId: string): Promise<boolean> {
  const row = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, resumeId),
      eq(schema.resumes.userId, userId),
      isNull(schema.resumes.deletedAt),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsResume(id, session.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const versions = await db
    .select({
      id: schema.resumeVersions.id,
      versionNumber: schema.resumeVersions.versionNumber,
      title: schema.resumeVersions.title,
      label: schema.resumeVersions.label,
      createdAt: schema.resumeVersions.createdAt,
    })
    .from(schema.resumeVersions)
    .where(eq(schema.resumeVersions.resumeId, id))
    .orderBy(desc(schema.resumeVersions.versionNumber));

  return NextResponse.json({ versions });
}

const RestoreBody = z.object({
  versionNumber: z.number().int().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await ownsResume(id, session.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: z.infer<typeof RestoreBody>;
  try {
    body = RestoreBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const version = await db.query.resumeVersions.findFirst({
    where: and(
      eq(schema.resumeVersions.resumeId, id),
      eq(schema.resumeVersions.versionNumber, body.versionNumber),
    ),
  });
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  const parsed = ResumeSchema.safeParse(version.content);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Version content invalid' }, { status: 500 });
  }

  // Snapshot the current state before restoring
  const currentResume = await db.query.resumes.findFirst({
    where: eq(schema.resumes.id, id),
  });
  if (currentResume) {
    const [latest] = await db
      .select({ version: schema.resumeVersions.versionNumber })
      .from(schema.resumeVersions)
      .where(eq(schema.resumeVersions.resumeId, id))
      .orderBy(desc(schema.resumeVersions.versionNumber))
      .limit(1);
    await db.insert(schema.resumeVersions).values({
      resumeId: id,
      versionNumber: (latest?.version ?? 0) + 1,
      content: currentResume.content,
      title: currentResume.title,
      label: 'pre-restore-snapshot',
    });
  }

  // Restore
  await db
    .update(schema.resumes)
    .set({
      content: parsed.data,
      title: version.title,
      locale: parsed.data.metadata.language,
      updatedAt: new Date(),
    })
    .where(eq(schema.resumes.id, id));

  auditEvent({
    userId: session.user.id,
    event: 'resume_updated',
    metadata: { resumeId: id, restoredVersion: body.versionNumber },
  });

  return NextResponse.json({ success: true, restoredVersion: body.versionNumber });
}
