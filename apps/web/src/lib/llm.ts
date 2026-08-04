/**
 * LLM orchestrator — wraps the provider-agnostic LLM layer with our
 * safety + persistence concerns.
 *
 * Resume generation is the one call-site that respects user model
 * preference. Caller resolves the pick (tier + preference → model
 * string) and passes it in.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sanitizeInput, buildPrompt, validateOutput } from '@resumaker/ai-safety';
import {
  PromptInjectionError,
  ValidationError,
  LLMError,
  ResumeSchema,
  type Resume,
  type Locale,
} from '@resumaker/shared';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { generateObject } from '@/lib/llm/provider';

const MAX_TOKENS = env.LLM_MAX_TOKENS;

/**
 * What the LLM actually generates: the resume content plus the job
 * identity extracted from the JD, in one call rather than a second
 * round-trip. job_title/company_name aren't part of `Resume` itself
 * (they describe the target job, not the person) — pulled back out
 * right after generation and stored as resumes.jobTitle/companyName,
 * which is what "My Resumes" displays instead of a free-text title.
 */
const GenerationOutputSchema = ResumeSchema.extend({
  job_title: z.string().min(1).max(200),
  company_name: z.string().min(1).max(200),
});

export interface GenerateResumeInput {
  userId: string;
  locale: Locale;
  jobDescription: string;
  /** The user's canonical career profile content (ProfileContent shape). */
  userProfile: Record<string, unknown>;
  /**
   * Gateway-format model string. Caller is responsible for resolving
   * the user preference + tier gate before passing this in. Falls back
   * to `env.DEFAULT_LLM_MODEL` when omitted.
   */
  modelString?: string;
}

export interface GenerateResumeResult {
  resume: Resume;
  /** Extracted from the JD by the same generation call — null if the LLM's output didn't parse. */
  jobTitle: string | null;
  companyName: string | null;
  generationId: string;
  durationMs: number;
  tokensUsed: { input: number; output: number };
}

export async function generateResume(input: GenerateResumeInput): Promise<GenerateResumeResult> {
  const startedAt = Date.now();
  const model = input.modelString ?? env.DEFAULT_LLM_MODEL;

  // ─── 1. Sanitize input ───
  const sanitized = sanitizeInput(input.jobDescription);
  if (sanitized.rejected) {
    void recordGeneration({
      ...input,
      model,
      status: 'rejected_input',
      error: sanitized.reason,
      safetyDetections: sanitized.detections,
      inputLength: input.jobDescription.length,
    });
    throw new PromptInjectionError(sanitized.reason ?? 'Input rejected');
  }

  // ─── 2. Build structured prompt ───
  const { system, user } = buildPrompt({
    locale: input.locale,
    jobDescription: sanitized.cleaned,
    userProfile: input.userProfile,
  });

  // ─── 3. Call the model with Zod-shaped structured output ───
  let result;
  try {
    result = await generateObject({
      model,
      schema: GenerationOutputSchema,
      system,
      prompt: user,
      maxOutputTokens: MAX_TOKENS,
      schemaName: 'resume',
      schemaDescription:
        'A tailored resume in the canonical Resume schema, plus the job_title and company_name extracted from the job description.',
      // Confirmed via NoObjectGeneratedError.finishReason === 'length' in
      // production QA: this call was missing the disableThinking flag
      // documented in provider.ts, so Gemini 2.5's default reasoning
      // tokens were eating a large, unpredictable share of MAX_TOKENS
      // before any visible resume JSON — causing frequent truncated-
      // response failures, and plausibly the shorter-than-expected
      // resumes on the runs that did complete. This is a bounded
      // tailoring/formatting task (profile + JD in, structured resume
      // out), not one that benefits from open-ended chain-of-thought.
      disableThinking: true,
    });
  } catch (err) {
    void recordGeneration({
      ...input,
      model,
      status: 'llm_error',
      error: (err as Error).message,
      safetyDetections: sanitized.detections,
      inputLength: sanitized.cleaned.length,
    });
    throw new LLMError(`LLM call failed: ${(err as Error).message}`, err);
  }

  // ─── 4. Validate output (defense in depth — the provider already
  // applied the Zod schema, but our safety layer also runs content
  // checks the schema can't express).
  const validation = validateOutput(result.object);
  const outputJsonText = JSON.stringify(result.object);

  if (!validation.valid || !validation.resume) {
    await recordGeneration({
      ...input,
      model,
      status: 'output_invalid',
      error: validation.errors.join('; '),
      safetyDetections: sanitized.detections,
      inputLength: sanitized.cleaned.length,
      outputLength: outputJsonText.length,
      promptTokens: result.usage.inputTokens,
      completionTokens: result.usage.outputTokens,
    });
    throw new ValidationError(`Output validation failed: ${validation.errors.join('; ')}`);
  }

  // job_title/company_name aren't part of ResumeSchema, so
  // validateOutput's ResumeSchema.safeParse() above silently dropped
  // them from `validation.resume` (Zod objects ignore unknown keys by
  // default) — pull them from the raw `result.object` instead, with
  // their own narrow schema so a malformed pair degrades to null
  // (falls back to the legacy `title` column) rather than failing the
  // whole generation over 2 non-essential fields.
  const jobIdentity = z
    .object({ job_title: z.string().min(1).max(200), company_name: z.string().min(1).max(200) })
    .safeParse(result.object);

  const durationMs = Date.now() - startedAt;

  const generationId = await recordGeneration({
    ...input,
    model,
    status: 'success',
    safetyDetections: [
      ...sanitized.detections,
      ...validation.warnings.map((w: string) => ({ warning: w })),
    ],
    inputLength: sanitized.cleaned.length,
    outputLength: outputJsonText.length,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    durationMs,
  });

  return {
    // `generated_at` is in the schema, so the model dutifully fills it —
    // and gets it wrong, emitting whatever date its training suggests
    // (observed: 2024-07-31 for a generation run in 2026). The server
    // knows the real answer, so don't ask a language model to guess a
    // clock. Stamped after validation so the schema still enforces that
    // the field exists and is a valid datetime.
    resume: {
      ...validation.resume,
      metadata: { ...validation.resume.metadata, generated_at: new Date().toISOString() },
    },
    jobTitle: jobIdentity.success ? jobIdentity.data.job_title : null,
    companyName: jobIdentity.success ? jobIdentity.data.company_name : null,
    generationId,
    durationMs,
    tokensUsed: {
      input: result.usage.inputTokens ?? 0,
      output: result.usage.outputTokens ?? 0,
    },
  };
}

interface RecordOpts {
  userId: string;
  locale: Locale;
  jobDescription: string;
  model: string;
  status: string;
  error?: string | undefined;
  safetyDetections?: unknown;
  inputLength: number;
  outputLength?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  durationMs?: number | undefined;
}

async function recordGeneration(opts: RecordOpts): Promise<string> {
  const hash = createHash('sha256').update(opts.jobDescription).digest('hex');

  const [row] = await db
    .insert(schema.generations)
    .values({
      userId: opts.userId,
      model: opts.model,
      inputJdHash: hash,
      inputLengthChars: opts.inputLength,
      outputLengthChars: opts.outputLength ?? null,
      promptTokens: opts.promptTokens ?? null,
      completionTokens: opts.completionTokens ?? null,
      durationMs: opts.durationMs ?? null,
      safetyDetections: opts.safetyDetections ?? null,
      status: opts.status,
      error: opts.error ?? null,
    })
    .returning({ id: schema.generations.id });

  return row?.id ?? 'unknown';
}
