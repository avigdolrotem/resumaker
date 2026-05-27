/**
 * POST /api/applications/[id]/prep — generate AI interview prep.
 *
 * Returns: { questions: string[], questionsToAsk: string[],
 *            companyResearch: string[], redFlags: string[] }
 *
 * Uses Claude haiku (fast + cheap). The response is NOT persisted —
 * callers can re-request to refresh. If users complain we'll add a
 * cache table.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { logger } from '@/lib/observability';
import { generateText } from '@/lib/llm/provider';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const app = await db
    .select({
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
      jobDescription: schema.jobs.description,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, guard.user.id)))
    .limit(1);

  if (!app[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const job = app[0];

  try {
    const response = await generateText({
      model: 'anthropic/claude-haiku-4-5@20251001',
      maxOutputTokens: 2000,
      system:
        'You generate concise interview preparation material. Return ONLY a JSON object with these exact keys: questions (array of likely interview questions, 8-12 items), questionsToAsk (array of smart questions the candidate should ask, 5-8 items), companyResearch (array of research hooks/topics to study, 4-6 items), redFlags (array of potential red flags to probe, 3-5 items). No markdown, no preamble.',
      prompt: `Job: ${job.jobTitle} at ${job.jobCompany}\n\nDescription:\n${job.jobDescription.slice(0, 6000)}`,
    });

    const text = response.text;

    // Strip markdown fences if present
    const cleaned = text
      .replace(/^```(?:json)?/m, '')
      .replace(/```$/m, '')
      .trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ prep: parsed });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, applicationId: id },
      'applications.prep.llm_failed',
    );
    return NextResponse.json({ error: 'Could not generate prep' }, { status: 502 });
  }
}
