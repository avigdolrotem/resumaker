/**
 * LLM orchestrator — wraps the provider-agnostic LLM layer with our
 * safety + persistence concerns.
 *
 * Resume generation is the one call-site that respects user model
 * preference. Caller resolves the pick (tier + preference → model
 * string) and passes it in.
 */

import { createHash } from 'node:crypto';
import { sanitizeInput, buildPrompt, validateOutput } from '@resumaker/ai-safety';
import {
  PromptInjectionError,
  ValidationError,
  LLMError,
  ResumeSchema,
  type Resume,
  type Locale,
  type Industry,
} from '@resumaker/shared';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { generateObject } from '@/lib/llm/provider';

const MAX_TOKENS = env.LLM_MAX_TOKENS;

export interface GenerateResumeInput {
  userId: string;
  locale: Locale;
  jobDescription: string;
  userProfile: Record<string, unknown>;
  industry?: Industry;
  /**
   * Gateway-format model string. Caller is responsible for resolving
   * the user preference + tier gate before passing this in. Falls back
   * to `env.DEFAULT_LLM_MODEL` when omitted.
   */
  modelString?: string;
}

export interface GenerateResumeResult {
  resume: Resume;
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
    ...(input.industry ? { industry: input.industry } : {}),
  });

  // ─── 3. Call the model with Zod-shaped structured output ───
  let result;
  try {
    result = await generateObject({
      model,
      schema: ResumeSchema,
      system,
      prompt: user,
      maxOutputTokens: MAX_TOKENS,
      schemaName: 'resume',
      schemaDescription: 'A tailored resume in the canonical Resume schema.',
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
    resume: validation.resume,
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
