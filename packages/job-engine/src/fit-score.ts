import type Anthropic from '@anthropic-ai/sdk';
import type { FitScore, NormalizedJob, UserProfile } from './types.js';

const FIT_SCORE_SYSTEM = `You are a technical recruiter evaluating candidate-job fit.

Score how well the candidate's profile matches the job description on a scale of 1-10.

Scoring guide:
- 9-10: Near-perfect match, candidate exceeds requirements
- 7-8: Strong match, meets most requirements
- 5-6: Partial match, significant gaps but transferable skills
- 3-4: Weak match, major gaps
- 1-2: Poor match

Be honest. A lower score helps filter, not hurts.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIT_TOOL: any = {
  name: 'score_fit',
  description: 'Output the candidate-job fit evaluation',
  input_schema: {
    type: 'object',
    required: ['score', 'rationale', 'strengths', 'gaps'],
    properties: {
      score: { type: 'number', minimum: 1, maximum: 10 },
      rationale: { type: 'string', description: 'One sentence explanation' },
      strengths: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
    },
  },
};

export interface ComputeFitScoreOpts {
  profile: UserProfile;
  job: NormalizedJob;
  anthropic: Anthropic;
}

function profileToText(profile: UserProfile): string {
  return Object.entries(profile)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}

/**
 * Use Claude haiku to score how well a candidate profile fits a job.
 * Returns a FitScore — never throws.
 */
export async function computeFitScore(opts: ComputeFitScoreOpts): Promise<FitScore> {
  const { profile, job, anthropic } = opts;
  const profileText = profileToText(profile).slice(0, 4_000);
  const jdText = `Company: ${job.company}\nTitle: ${job.title}\n\n${job.description}`.slice(
    0,
    4_000,
  );

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: FIT_SCORE_SYSTEM,
      tools: [FIT_TOOL],
      tool_choice: { type: 'tool', name: 'score_fit' },
      messages: [
        {
          role: 'user',
          content: `CANDIDATE:\n${profileText}\n\nJOB:\n${jdText}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'score_fit',
    );

    if (!toolUse) return fallback();

    const data = toolUse.input as {
      score: number;
      rationale: string;
      strengths: string[];
      gaps: string[];
    };

    return {
      score: data.score,
      rationale: data.rationale,
      strengths: data.strengths ?? [],
      gaps: data.gaps ?? [],
    };
  } catch {
    return fallback();
  }
}

function fallback(): FitScore {
  return { score: 0, rationale: 'Could not score', strengths: [], gaps: [] };
}
