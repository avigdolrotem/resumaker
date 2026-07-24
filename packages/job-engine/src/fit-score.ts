import { generateObject } from 'ai';
import { z } from 'zod';
import { resolveModel, thinkingProviderOptions } from './model';
import type { FitScore, NormalizedJob, UserProfile } from './types';

const FIT_SCORE_SYSTEM = `You are a technical recruiter evaluating candidate-job fit.

Score how well the candidate's profile matches the job description on a scale of 1-10.

Scoring guide:
- 9-10: Near-perfect match, candidate exceeds requirements
- 7-8: Strong match, meets most requirements
- 5-6: Partial match, significant gaps but transferable skills
- 3-4: Weak match, major gaps
- 1-2: Poor match

Be honest. A lower score helps filter, not hurts.`;

const FitScoreSchema = z.object({
  score: z.number().min(1).max(10),
  rationale: z.string().describe('One sentence explanation'),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export interface ComputeFitScoreOpts {
  profile: UserProfile;
  job: NormalizedJob;
  modelString?: string;
}

function profileToText(profile: UserProfile): string {
  return Object.entries(profile)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}

/**
 * Use an LLM (default: google/gemini-2.5-flash — see apps/web/src/lib/llm/
 * models.ts for why Haiku 4.5 isn't the default right now) to score how
 * well a candidate profile fits a job.  Returns a FitScore — never throws.
 */
export async function computeFitScore(opts: ComputeFitScoreOpts): Promise<FitScore> {
  const { profile, job, modelString = 'google/gemini-2.5-flash' } = opts;
  const profileText = profileToText(profile).slice(0, 4_000);
  const jdText = `Company: ${job.company}\nTitle: ${job.title}\n\n${job.description}`.slice(
    0,
    4_000,
  );

  const providerOptions = thinkingProviderOptions(modelString);

  try {
    const result = await generateObject({
      model: resolveModel(modelString),
      schema: FitScoreSchema,
      maxOutputTokens: 512,
      system: FIT_SCORE_SYSTEM,
      prompt: `CANDIDATE:\n${profileText}\n\nJOB:\n${jdText}`,
      ...(providerOptions !== undefined && { providerOptions }),
    });

    return {
      score: result.object.score,
      rationale: result.object.rationale,
      strengths: result.object.strengths ?? [],
      gaps: result.object.gaps ?? [],
    };
  } catch (err) {
    // Was a bare `catch { return fallback() }` — every failure silently
    // vanished with zero visibility into why, which is exactly how the
    // thinking-budget bug above went undiagnosed until it was caught
    // live. Still "never throws" (callers keep the same contract), but
    // now at least logged.
    console.error('[job-engine] computeFitScore failed, returning fallback:', err);
    return fallback();
  }
}

function fallback(): FitScore {
  return { score: 0, rationale: 'Could not score', strengths: [], gaps: [] };
}
