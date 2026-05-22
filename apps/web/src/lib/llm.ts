/**
 * LLM orchestrator — wraps Anthropic SDK with our safety layer.
 *
 * Single entry point for resume generation. Handles:
 *  - Building safety-conscious prompts
 *  - Calling the model
 *  - Validating output
 *  - Persisting the generation record
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { sanitizeInput, buildPrompt, validateOutput } from '@resumaker/ai-safety';
import {
  PromptInjectionError,
  ValidationError,
  LLMError,
  type Resume,
  type Locale,
  type Industry,
} from '@resumaker/shared';
import { db, schema } from '@/db';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

const MODEL = process.env.DEFAULT_LLM_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? '4096', 10);
const TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS ?? '60000', 10);

const client = new Anthropic({
  apiKey,
  timeout: TIMEOUT_MS,
});

/**
 * JSON Schema for the resume tool. Mirrors packages/shared ResumeSchema (Zod).
 * Anthropic uses JSON Schema, not Zod, for tool definitions.
 */
// Use mutable array shapes (no `as const`) so the Anthropic SDK types accept it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RESUME_JSON_SCHEMA: any = {
  type: 'object',
  required: ['metadata', 'contact', 'summary', 'experience', 'education', 'skills'],
  properties: {
    metadata: {
      type: 'object',
      required: ['language', 'generated_at', 'template'],
      properties: {
        language: { type: 'string', enum: ['he', 'en'] },
        generated_at: { type: 'string', description: 'ISO 8601 datetime' },
        industry: { type: 'string', enum: ['tech', 'healthcare', 'finance', 'general'] },
        template: { type: 'string', maxLength: 50 },
      },
    },
    contact: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', maxLength: 50 },
        location: { type: 'string', maxLength: 200 },
        linkedin: { type: 'string', format: 'uri' },
        github: { type: 'string', format: 'uri' },
        website: { type: 'string', format: 'uri' },
      },
    },
    summary: { type: 'string', maxLength: 2000 },
    experience: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['company', 'title', 'start_date', 'end_date'],
        properties: {
          company: { type: 'string', minLength: 1, maxLength: 200 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null for current' },
          location: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          highlights: {
            type: 'array',
            maxItems: 10,
            items: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    education: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['institution', 'degree', 'start_date', 'end_date'],
        properties: {
          institution: { type: 'string', minLength: 1, maxLength: 200 },
          degree: { type: 'string', maxLength: 200 },
          field: { type: 'string', maxLength: 200 },
          start_date: { type: 'string' },
          end_date: { type: ['string', 'null'] },
          gpa: { type: 'string', maxLength: 20 },
          description: { type: 'string', maxLength: 1000 },
        },
      },
    },
    skills: {
      type: 'array',
      maxItems: 50,
      items: { type: 'string', maxLength: 100 },
    },
    languages: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 50 },
          level: { type: 'string', maxLength: 50 },
        },
      },
    },
    certifications: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 200 },
          issuer: { type: 'string', maxLength: 200 },
          date: { type: 'string' },
        },
      },
    },
  },
};

export interface GenerateResumeInput {
  userId: string;
  locale: Locale;
  jobDescription: string;
  userProfile: Record<string, unknown>;
  industry?: Industry;
}

export interface GenerateResumeResult {
  resume: Resume;
  generationId: string;
  durationMs: number;
  tokensUsed: { input: number; output: number };
}

export async function generateResume(input: GenerateResumeInput): Promise<GenerateResumeResult> {
  const startedAt = Date.now();

  // ─── 1. Sanitize input ───
  const sanitized = sanitizeInput(input.jobDescription);

  if (sanitized.rejected) {
    await recordGeneration({
      ...input,
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

  // ─── 3. Call the model with tool-use for structured output ───
  // Force JSON output via tool definition. Claude must call the tool with
  // arguments matching our schema, eliminating freeform text + markdown.
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: [
        {
          name: 'submit_resume',
          description: 'Submit the generated resume as structured JSON',
          input_schema: RESUME_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_resume' },
      messages: [{ role: 'user', content: user }],
    });
  } catch (err) {
    await recordGeneration({
      ...input,
      status: 'llm_error',
      error: (err as Error).message,
      safetyDetections: sanitized.detections,
      inputLength: sanitized.cleaned.length,
    });
    throw new LLMError(`LLM call failed: ${(err as Error).message}`, err);
  }

  // ─── 4. Extract structured tool input ───
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_resume',
  );
  if (!toolUse) {
    throw new LLMError('LLM did not call submit_resume tool');
  }

  // ─── 5. Validate output against Zod schema ───
  const validation = validateOutput(toolUse.input);
  const outputJsonText = JSON.stringify(toolUse.input);

  if (!validation.valid || !validation.resume) {
    await recordGeneration({
      ...input,
      status: 'output_invalid',
      error: validation.errors.join('; '),
      safetyDetections: sanitized.detections,
      inputLength: sanitized.cleaned.length,
      outputLength: outputJsonText.length,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    });
    throw new ValidationError(`Output validation failed: ${validation.errors.join('; ')}`);
  }

  const durationMs = Date.now() - startedAt;

  // ─── 6. Record generation ───
  const generationId = await recordGeneration({
    ...input,
    status: 'success',
    safetyDetections: [
      ...sanitized.detections,
      ...validation.warnings.map((w) => ({ warning: w })),
    ],
    inputLength: sanitized.cleaned.length,
    outputLength: outputJsonText.length,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    durationMs,
  });

  return {
    resume: validation.resume,
    generationId,
    durationMs,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

interface RecordOpts {
  userId: string;
  locale: Locale;
  jobDescription: string;
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
      model: MODEL,
      inputJdHash: hash,
      inputLengthChars: opts.inputLength,
      outputLengthChars: opts.outputLength ?? null,
      promptTokens: opts.promptTokens ?? null,
      completionTokens: opts.completionTokens ?? null,
      durationMs: opts.durationMs ?? null,
      safetyDetections: opts.safetyDetections
        ? JSON.parse(JSON.stringify(opts.safetyDetections))
        : null,
      status: opts.status,
      error: opts.error ?? null,
    })
    .returning({ id: schema.generations.id });

  return row?.id ?? 'unknown';
}
