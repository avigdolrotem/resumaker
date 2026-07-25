/**
 * Dashboard job recommendations: a 3-stage funnel from "every open job"
 * down to a handful of LLM-scored picks, written to `userJobs` so the
 * dashboard only ever reads precomputed rows — it never scores anything
 * at request time. Called by the nightly /api/cron/generate-recommendations
 * batch, one user at a time.
 *
 * Why a funnel instead of just LLM-scoring everything: at 17k+ open jobs,
 * running computeFitScore (an LLM call) against every open job for every
 * active user is the cost/latency mistake the whole funnel exists to
 * avoid. Stage 1 (SQL, milliseconds) does the heavy lifting cheaply;
 * the LLM only ever sees a double-digit shortlist.
 */

import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { extractKeywords } from '@resumaker/ats-scorer';
import { computeFitScore, type NormalizedJob, type Source } from '@resumaker/job-engine';
import { logger } from '@/lib/observability';
import { ISRAELI_LOCATION_RE } from '@/lib/jobs-query';

const STAGE1_LIMIT = 50;
const STAGE2_LIMIT = 10;
const TOP_KEYWORDS = 20;

interface ProfileExperience {
  title?: string;
  company?: string;
  description?: string;
  highlights?: string[];
}
interface ProfileEducation {
  institution?: string;
  degree?: string;
  field?: string;
}
interface ProfileContentShape {
  summary?: string;
  experience?: ProfileExperience[];
  education?: ProfileEducation[];
  skills?: string[];
}

/** Same text-aggregation shape scoreResume already uses for a resume, applied to profile content instead. */
function profileToSearchText(content: Record<string, unknown>): string {
  const c = content as ProfileContentShape;
  return [
    c.summary,
    ...(c.experience ?? []).flatMap((e) => [
      e.title,
      e.company,
      e.description,
      ...(e.highlights ?? []),
    ]),
    ...(c.education ?? []).flatMap((e) => [e.institution, e.degree, e.field]),
    ...(c.skills ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

interface RetrievedJob {
  id: string;
  source: string;
  externalId: string | null;
  company: string;
  title: string;
  location: string | null;
  description: string;
  url: string;
  urlNormalized: string;
  remote: boolean;
  seniority: string | null;
  postedAt: Date | null;
  hrUserId: string | null;
}

/** Stage 1: SQL retrieval, ranked by keyword-overlap relevance then recency. */
async function retrieveStage1(profileContent: Record<string, unknown>): Promise<RetrievedJob[]> {
  const keywords = extractKeywords(profileToSearchText(profileContent))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, TOP_KEYWORDS)
    .map((k) => k.keyword);

  if (keywords.length === 0) return [];

  // websearch_to_tsquery treats whitespace-separated bare terms as AND —
  // OR-join explicitly. Quoting each keyword treats a multi-word bigram
  // (extractKeywords returns those too) as a phrase instead of splitting
  // it into two independent terms.
  const queryText = keywords.map((k) => `"${k.replace(/"/g, '')}"`).join(' OR ');
  const tsQuery = sql`websearch_to_tsquery('simple', ${queryText})`;

  return db
    .select({
      id: schema.jobs.id,
      source: schema.jobs.source,
      externalId: schema.jobs.externalId,
      company: schema.jobs.company,
      title: schema.jobs.title,
      location: schema.jobs.location,
      description: schema.jobs.description,
      url: schema.jobs.url,
      urlNormalized: schema.jobs.urlNormalized,
      remote: schema.jobs.remote,
      seniority: schema.jobs.seniority,
      postedAt: schema.jobs.postedAt,
      hrUserId: schema.jobs.hrUserId,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.status, 'open'),
        isNull(schema.jobs.canonicalJobId),
        sql`${schema.jobs.searchVector} @@ ${tsQuery}`,
        // Same Israeli-only guard as the jobs list (jobs-query.ts) — recs
        // draw from the same table and a stray non-Israeli row (e.g. a
        // manually-imported one) shouldn't be able to reach the dashboard
        // just because this funnel has its own query.
        sql`(${schema.jobs.source} IN ('taasuka', 'hr') OR ${schema.jobs.location} ~* ${ISRAELI_LOCATION_RE.source})`,
      ),
    )
    .orderBy(
      desc(sql`ts_rank(${schema.jobs.searchVector}, ${tsQuery})`),
      desc(schema.jobs.scrapedAt),
    )
    .limit(STAGE1_LIMIT);
}

/**
 * Stage 2: heuristic cut from ~50 to ~10. Excludes jobs the user already
 * dismissed or is already tracking in their application pipeline —
 * recommending something they've already acted on is noise, not help.
 * HR-posted jobs get a ranking boost: Rotem's explicit product decision
 * (2026-07-23, went against the fit-only-no-boost recommendation) — this
 * re-sorts within the Stage-1 relevance order, it doesn't re-rank from
 * scratch, and it must ship with disclosure in the UI (a "Posted
 * directly by {Company}" badge on the dashboard card), not a silent
 * reorder.
 */
async function filterAndRankStage2(
  userId: string,
  candidates: RetrievedJob[],
): Promise<RetrievedJob[]> {
  if (candidates.length === 0) return [];
  const jobIds = candidates.map((c) => c.id);

  const [dismissedRows, appliedRows] = await Promise.all([
    db.query.userJobs.findMany({
      where: and(eq(schema.userJobs.userId, userId), inArray(schema.userJobs.jobId, jobIds)),
      columns: { jobId: true, dismissedAt: true },
    }),
    db.query.applications.findMany({
      where: and(
        eq(schema.applications.userId, userId),
        inArray(schema.applications.jobId, jobIds),
      ),
      columns: { jobId: true },
    }),
  ]);

  const dismissedIds = new Set(dismissedRows.filter((r) => r.dismissedAt).map((r) => r.jobId));
  const trackedIds = new Set(appliedRows.map((r) => r.jobId));
  const eligible = candidates.filter((c) => !dismissedIds.has(c.id) && !trackedIds.has(c.id));

  const ranked = [...eligible].sort((a, b) => (b.hrUserId ? 1 : 0) - (a.hrUserId ? 1 : 0));
  return ranked.slice(0, STAGE2_LIMIT);
}

export interface GenerateRecommendationsResult {
  candidatesFound: number;
  scored: number;
  errors: string[];
}

/**
 * Full funnel for one user. Also clears recommendedAt on any of the
 * user's previous recommendations that didn't make this run's fresh
 * top-10 — otherwise a stale pick from a week ago (no longer even in
 * the Stage-1 candidate pool) lingers on the dashboard indefinitely.
 * Never touches dismissedAt: a user's dismissal is permanent regardless
 * of what a later run recomputes (Stage 2 already excludes dismissed
 * jobs from ever being reconsidered here in the first place).
 */
export async function generateRecommendationsForUser(
  userId: string,
): Promise<GenerateRecommendationsResult> {
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
  });
  if (!profileRow?.onboardingCompletedAt) {
    return { candidatesFound: 0, scored: 0, errors: [] };
  }

  const profileContent = profileRow.content as Record<string, unknown>;
  const stage1 = await retrieveStage1(profileContent);
  const stage2 = await filterAndRankStage2(userId, stage1);
  const stage2Ids = stage2.map((j) => j.id);

  await db
    .update(schema.userJobs)
    .set({ recommendedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.userJobs.userId, userId),
        sql`${schema.userJobs.recommendedAt} IS NOT NULL`,
        ...(stage2Ids.length > 0 ? [notInArray(schema.userJobs.jobId, stage2Ids)] : []),
      ),
    );

  const errors: string[] = [];
  let scored = 0;
  const now = new Date();

  for (const job of stage2) {
    const normalizedJob: NormalizedJob = {
      externalId: job.externalId ?? job.id,
      source: job.source as Source,
      company: job.company,
      title: job.title,
      ...(job.location ? { location: job.location } : {}),
      description: job.description,
      url: job.url,
      urlNormalized: job.urlNormalized,
      remote: job.remote,
      ...(job.seniority ? { seniority: job.seniority } : {}),
      ...(job.postedAt ? { postedAt: job.postedAt } : {}),
    };

    try {
      const fit = await computeFitScore({ profile: profileContent, job: normalizedJob });

      // computeFitScore "never throws" by design — a transient LLM
      // failure returns { score: 0, rationale: 'Could not score', ... }
      // instead of rejecting (verified live: this does happen, not just
      // theoretical — a real call in testing hit it). FitScoreSchema
      // requires min(1), so a genuine LLM response can never actually
      // produce 0; treat it the same as a thrown error rather than
      // writing a garbage "0/10, Could not score" recommendation a user
      // would see on their dashboard. Retried on the next batch run,
      // same as any other transient failure here.
      if (fit.score === 0) {
        throw new Error(`computeFitScore returned its internal failure fallback: ${fit.rationale}`);
      }

      await db
        .insert(schema.userJobs)
        .values({
          userId,
          jobId: job.id,
          fitScore: fit.score,
          fitRationale: fit.rationale,
          fitStrengths: fit.strengths,
          fitGaps: fit.gaps,
          fitScoredAt: now,
          recommendedAt: now,
          recommendScore: fit.score,
        })
        .onConflictDoUpdate({
          target: [schema.userJobs.userId, schema.userJobs.jobId],
          set: {
            fitScore: fit.score,
            fitRationale: fit.rationale,
            fitStrengths: fit.strengths,
            fitGaps: fit.gaps,
            fitScoredAt: now,
            recommendedAt: now,
            recommendScore: fit.score,
            updatedAt: now,
          },
        });
      scored++;
    } catch (err) {
      errors.push(`${job.id}: ${(err as Error).message}`);
      logger.warn(
        { err: (err as Error).message, jobId: job.id, userId },
        'recommendations.fit_score_failed',
      );
    }
  }

  return { candidatesFound: stage2.length, scored, errors };
}
