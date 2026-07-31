/**
 * POST /api/jobs/import — paste a URL (or raw text) → extract job → create.
 *
 * Body:
 *   { url: string } | { text: string }  (one of)
 *
 * Flow:
 *   1. Beta + auth gate.
 *   2. Normalize URL, dedupe by url_normalized (return existing row id
 *      if already imported).
 *   3. If url: @resumaker/job-engine's `importJobFromUrl` fetches the
 *      page and extracts title/company/description via an LLM call
 *      (retried once on failure). If text: skip the fetch, hand the
 *      pasted text straight to the minimal-row path.
 *   4. For a url-mode extraction, `verifyManualImport` runs a second,
 *      cheap LLM pass checking the extraction against the same fetched
 *      page content — rejects with 422 only on a high-confidence "this
 *      isn't actually a real job posting" verdict; anything uncertain
 *      (including the check itself failing) lets the import through,
 *      same as before this existed. See verify-import.ts for why this
 *      exists and its AI-security posture (the fetched content is
 *      fully untrusted input).
 *   5. Insert + audit. status is 'open' for a trusted submitter
 *      (admin/hr/admin-granted — see lib/content-trust.ts) or 'pending'
 *      otherwise: the row exists and the submitter can see it directly
 *      at /jobs/[id], but it's excluded from the shared /jobs feed
 *      until an admin approves it at /admin/moderation. This is a
 *      *different* check from step 4's AI content-plausibility pass —
 *      that asks "is this text a real job posting," this asks "is this
 *      submitter trusted enough to publish to everyone without a human
 *      looking at it first." Both run independently; passing one says
 *      nothing about the other.
 *
 * L5 beta-gated (in name only now — see beta-gate.ts, the whole
 * surface is free; the gate call stays for the auth/session load).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { isTrustedSharer } from '@/lib/content-trust';
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
  // Retries once on failure before falling back to "Unknown" placeholders
  // — verified live that a transient Vertex OAuth token hiccup (not a
  // code bug: retrying the exact same URL moments later extracted the
  // real title/company/description cleanly) was enough to leave a job
  // permanently stuck as "Imported from <host>" with the raw URL as its
  // description, with no way for the user to fix it short of re-pasting.
  // One retry absorbs exactly that class of blip; a second consecutive
  // failure is treated as a real problem with the URL/page itself.
  let extracted: {
    title: string;
    company: string;
    description: string;
    location?: string | undefined;
    remote?: boolean;
    seniority?: string | undefined;
  };
  if (body.url) {
    const { importJobFromUrl, verifyManualImport } = await import('@resumaker/job-engine');
    let lastErr: Error | undefined;
    let result: Awaited<ReturnType<typeof importJobFromUrl>> | undefined;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        result = await importJobFromUrl(body.url);
      } catch (err) {
        lastErr = err as Error;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (result) {
      const verdict = await verifyManualImport({
        title: result.job.title,
        company: result.job.company,
        description: result.job.description,
        rawContent: result.rawContent,
      });
      if (verdict && !verdict.isValid && verdict.confidence === 'high') {
        logger.warn(
          { userId: guard.user.id, reason: verdict.reason, url: body.url },
          'jobs.import.verification_rejected',
        );
        return NextResponse.json(
          {
            error:
              "This doesn't look like a valid job posting — try pasting the job description text directly instead.",
            code: 'IMPORT_VERIFICATION_FAILED',
            detail: verdict.reason,
          },
          { status: 422 },
        );
      }
      extracted = {
        title: result.job.title,
        company: result.job.company,
        description: result.job.description,
        location: result.job.location,
        remote: result.job.remote,
        seniority: result.job.seniority,
      };
    } else {
      logger.warn(
        { err: lastErr?.message, userId: guard.user.id },
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

  // Trusted submitters (admin/hr/admin-granted) publish immediately;
  // everyone else's import needs a review pass before it's visible to
  // anyone but themselves — see lib/content-trust.ts.
  const trusted = isTrustedSharer(guard.user);
  const status = trusted ? 'open' : 'pending';

  const [row] = await db
    .insert(schema.jobs)
    .values({
      externalId: null,
      source: 'manual',
      submittedByUserId: guard.user.id,
      company: extracted.company,
      title: extracted.title,
      ...(extracted.location ? { location: extracted.location } : {}),
      description: extracted.description,
      url: sourceUrl,
      urlNormalized: urlNorm,
      remote: extracted.remote ?? false,
      ...(extracted.seniority ? { seniority: extracted.seniority } : {}),
      status,
    })
    .returning({ id: schema.jobs.id });

  auditEvent({
    userId: guard.user.id,
    event: 'resume_created', // re-uses existing event name to avoid a schema change; metadata distinguishes
    metadata: { kind: 'job_imported', jobId: row?.id, source: 'manual', status },
  });

  return NextResponse.json({ id: row?.id, deduped: false, pendingReview: !trusted });
}
