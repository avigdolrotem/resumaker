/**
 * GET  /api/cover-letters     — list user's saved cover letters
 * POST /api/cover-letters     — save a generated cover letter
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const letters = await db.query.coverLetters.findMany({
    where: and(
      eq(schema.coverLetters.userId, session.user.id),
      isNull(schema.coverLetters.deletedAt),
    ),
    orderBy: [desc(schema.coverLetters.updatedAt)],
    columns: {
      id: true,
      title: true,
      companyName: true,
      tone: true,
      locale: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ letters });
}

const PostBodySchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(10_000),
  jobDescription: z.string().max(20_000).optional(),
  companyName: z.string().max(200).optional(),
  recipientName: z.string().max(200).optional(),
  tone: z.enum(['formal', 'friendly', 'enthusiastic']).default('formal'),
  locale: z.enum(['he', 'en']),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    .insert(schema.coverLetters)
    .values({
      userId: session.user.id,
      title: body.title,
      content: body.content,
      jobDescription: body.jobDescription ?? null,
      companyName: body.companyName ?? null,
      recipientName: body.recipientName ?? null,
      tone: body.tone,
      locale: body.locale,
    })
    .returning({ id: schema.coverLetters.id });

  auditEvent({
    userId: session.user.id,
    event: 'resume_created',
    metadata: { kind: 'cover_letter', id: row?.id },
  });

  return NextResponse.json({ id: row?.id });
}
