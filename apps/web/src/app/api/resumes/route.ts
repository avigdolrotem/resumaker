/**
 * GET  /api/resumes        — list current user's resumes
 * POST /api/resumes        — save a generated resume
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ResumeSchema } from '@resumaker/shared';

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const list = await db.query.resumes.findMany({
    where: and(eq(schema.resumes.userId, session.user.id), isNull(schema.resumes.deletedAt)),
    orderBy: [desc(schema.resumes.updatedAt)],
    columns: {
      id: true,
      title: true,
      locale: true,
      industry: true,
      templateId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ resumes: list });
}

const PostBodySchema = z.object({
  title: z.string().min(1).max(255),
  content: ResumeSchema,
  templateId: z.string().max(50).default('modern-1'),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof PostBodySchema>;
  try {
    body = PostBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(schema.resumes)
    .values({
      userId: session.user.id,
      title: body.title,
      locale: body.content.metadata.language,
      industry: body.content.metadata.industry ?? null,
      templateId: body.templateId,
      content: body.content,
    })
    .returning({ id: schema.resumes.id });

  return NextResponse.json({ id: row?.id });
}
