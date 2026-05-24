/**
 * POST /api/applications/[id]/follow-up — generate follow-up email.
 *
 * Body: { kind: 'follow_up' | 'thank_you' }
 *
 * Two AI-generated email drafts:
 *  - follow_up: after submitting application, no reply yet
 *  - thank_you: after an interview
 *
 * Returns { subject, body }. Not persisted — user copies + sends from
 * their own client.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { logger } from '@/lib/observability';

const Body = z.object({ kind: z.enum(['follow_up', 'thank_you']) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const app = await db
    .select({
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
      contactName: schema.applications.contactName,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, guard.user.id)))
    .limit(1);

  if (!app[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const a = app[0];

  const isHebrew = guard.user.locale === 'he';
  const promptKind = body.kind === 'thank_you' ? 'post-interview thank-you' : 'gentle follow-up';

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Generate a ${promptKind} email in ${isHebrew ? 'Hebrew' : 'English'}. Return JSON only: {"subject":"...","body":"..."}. Be concise (5-8 sentences body max), warm but professional, no platitudes.`,
      messages: [
        {
          role: 'user',
          content: `Candidate: ${guard.user.name ?? '[name]'}
Job: ${a.jobTitle} at ${a.jobCompany}
Recipient: ${a.contactName ?? 'Hiring Manager'}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .replace(/^```(?:json)?/m, '')
      .replace(/```$/m, '')
      .trim();

    const parsed = JSON.parse(text);
    return NextResponse.json({ email: parsed });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, applicationId: id, kind: body.kind },
      'applications.follow_up.llm_failed',
    );
    return NextResponse.json({ error: 'Could not generate email' }, { status: 502 });
  }
}
