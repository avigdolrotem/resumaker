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
import { canCreateResume, getActiveResumeCount, getUserTier } from '@/lib/billing/tier';

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

/**
 * Hard cap on serialized resume size — protects against a malicious or
 * runaway client packing 16 MB of JSONB into a single row. Realistic
 * resumes serialize to 2-8 KB, so 64 KB is generous (10× headroom).
 */
const MAX_RESUME_BYTES = 64 * 1024;

const PostBodySchema = z.object({
  title: z.string().min(1).max(255),
  content: ResumeSchema.refine(
    (c) => JSON.stringify(c).length <= MAX_RESUME_BYTES,
    `Resume content exceeds ${MAX_RESUME_BYTES / 1024} KB limit`,
  ),
  templateId: z.string().max(50).default('modern'),
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

  // Tier gate: cap number of active resumes per tier.
  const [tier, activeCount] = await Promise.all([
    getUserTier(session.user.id),
    getActiveResumeCount(session.user.id),
  ]);
  const gate = canCreateResume(tier, activeCount);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Resume limit reached for your tier',
        code: 'TIER_LIMIT',
        reasonKey: gate.reasonKey,
        requiredTier: gate.requiredTier,
        current: gate.current,
        limit: gate.limit,
      },
      { status: 402 }, // Payment Required
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
