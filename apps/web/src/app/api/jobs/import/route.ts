/**
 * POST /api/jobs/import — paste a URL (or raw text) → extract job → create.
 *
 * Body:
 *   { url: string } | { text: string }  (one of)
 *
 * Flow:
 *   1. Beta + auth gate.
 *   2. If url: fetch + strip HTML to plain text. If text: use as-is.
 *   3. Call @resumaker/job-engine `importJobFromUrl` (which wraps an
 *      Anthropic haiku call to extract title/company/description).
 *   4. Normalize URL, dedupe by url_normalized (return existing row id
 *      if already imported).
 *   5. Insert + audit.
 *
 * L5 beta-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { checkRateLimit } from '@/lib/rate-limit';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';

const BodySchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().min(50).max(20_000).optional(),
  })
  .refine((d) => d.url || d.text, { message: 'Provide url or text' });

/** Quick URL normalizer — strip query+fragment, lowercase host, drop trailing slash */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.toLowerCase().split('?')[0]!.split('#')[0]!.replace(/\/$/, '');
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  // See the matching comment in applications/[id]/prep/route.ts — this
  // beta-surface LLM route had no rate limit, unlike every other one.
  // Tighter than its siblings since a url-mode import is also an
  // unbounded server-side outbound fetch against a third-party site,
  // not just an LLM call.
  const rl = await checkRateLimit(`job-import:${guard.user.id}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const sourceUrl = body.url ?? 'manual-paste';
  const urlNorm = body.url ? normalizeUrl(body.url) : `manual:${guard.user.id}:${Date.now()}`;

  // Dedupe — if user already imported this URL, return the existing row.
  if (body.url) {
    const existing = await db.query.jobs.findFirst({
      where: eq(schema.jobs.urlNormalized, urlNorm),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, deduped: true });
    }
  }

  // Try the package's importer when we have a URL. For text-paste we
  // skip the URL fetch and ask Claude to extract from the raw text only.
  // The importer never throws — on failure it returns a NormalizedJob
  // with sensible "Unknown" placeholders, which the user can edit.
  let extracted: {
    title: string;
    company: string;
    description: string;
    location?: string | undefined;
    remote?: boolean;
    seniority?: string | undefined;
  };
  if (body.url) {
    try {
      const { importJobFromUrl } = await import('@resumaker/job-engine');
      const result = await importJobFromUrl(body.url);
      extracted = {
        title: result.title,
        company: result.company,
        description: result.description,
        location: result.location,
        remote: result.remote,
        seniority: result.seniority,
      };
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, userId: guard.user.id },
        'jobs.import.llm_failed_using_fallback',
      );
      extracted = {
        title: `Imported from ${new URL(body.url).hostname}`,
        company: 'Unknown',
        description: sourceUrl,
      };
    }
  } else {
    // Text-paste path: skip URL fetch, hand text directly to extractor.
    // (The job-engine importer fetches its own URL, so for text-only we
    // do the simpler minimal-row path and let the user edit fields.)
    extracted = {
      title: 'Pasted job',
      company: 'Unknown',
      description: body.text ?? '',
    };
  }

  const [row] = await db
    .insert(schema.jobs)
    .values({
      externalId: null,
      source: 'manual',
      company: extracted.company,
      title: extracted.title,
      ...(extracted.location ? { location: extracted.location } : {}),
      description: extracted.description,
      url: sourceUrl,
      urlNormalized: urlNorm,
      remote: extracted.remote ?? false,
      ...(extracted.seniority ? { seniority: extracted.seniority } : {}),
    })
    .returning({ id: schema.jobs.id });

  auditEvent({
    userId: guard.user.id,
    event: 'resume_created', // re-uses existing event name to avoid a schema change; metadata distinguishes
    metadata: { kind: 'job_imported', jobId: row?.id, source: 'manual' },
  });

  return NextResponse.json({ id: row?.id, deduped: false });
}
