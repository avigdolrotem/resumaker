/**
 * Provider-agnostic wrapper over GCP Vertex AI + AI SDK v6.
 *
 * The rest of the app uses these two functions instead of touching `ai`
 * or `@ai-sdk/google-vertex` directly. That keeps provider swaps a
 * single-file diff.
 *
 * Routing — the model string is `provider/model`:
 *   - `anthropic/X` → Claude on Vertex (vertexAnthropic provider)
 *   - `google/X`    → Gemini on Vertex (vertex provider)
 *
 * Auth: Vertex uses Application Default Credentials. In GKE pods this
 * resolves through Workload Identity to the resumaker-app SA, which has
 * `roles/aiplatform.user`. In local dev: `gcloud auth application-default
 * login` once and you're set.
 */
import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
  NoObjectGeneratedError,
  type LanguageModelUsage,
} from 'ai';
import { vertex } from '@ai-sdk/google-vertex';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { ZodError, type ZodSchema } from 'zod';
import { env } from '@/lib/env';

/** Resolve `provider/model` to a Vertex-backed AI SDK model. */
function resolveModel(modelString: string) {
  const slash = modelString.indexOf('/');
  if (slash === -1) {
    throw new Error(`Invalid model string "${modelString}" — expected "provider/model"`);
  }
  const provider = modelString.slice(0, slash);
  const modelId = modelString.slice(slash + 1);

  switch (provider) {
    case 'anthropic':
      return vertexAnthropic(modelId);
    case 'google':
      return vertex(modelId);
    default:
      throw new Error(`Unsupported provider "${provider}" — use 'anthropic' or 'google'`);
  }
}

/**
 * Gemini 2.5 models "think" by default — reasoning tokens come out of
 * the same maxOutputTokens budget as the visible response, silently.
 * For a quick single-shot JSON/text answer (no multi-step reasoning
 * needed) that can eat the entire budget before any visible text is
 * produced: a 512-token budget on gemini-2.5-flash returned 487
 * reasoning tokens and 21 text tokens, truncating mid-response every
 * time. `disableThinking` sets thinkingBudget: 0 (only takes effect for
 * `google/*` models — Claude's extended thinking is a different
 * mechanism entirely and isn't affected). Prefer this over just raising
 * maxOutputTokens for anything that doesn't need reasoning: it's also
 * faster and cheaper.
 *
 * gemini-2.5-pro is the one exception: Vertex rejects thinkingBudget:0
 * outright for it ("The model does not support setting thinking_budget
 * to 0" — verified live, 100% reproducible, not intermittent) unlike
 * flash/flash-lite which allow disabling thinking entirely. Pro can't
 * have its thinking turned off, so every disableThinking caller
 * (resume generation chief among them) was hard-failing every single
 * time a user had Pro selected. Leaving thinkingConfig unset entirely
 * (Pro's own default/dynamic budget) was tried first and made things
 * worse, not better: verified live, a real generateObject call took 54s
 * and came back "No object generated: could not parse the response" —
 * Pro's unbounded thinking trace appears to interfere with the SDK's
 * structured-output extraction. A small non-zero budget is the actual
 * fix: keeps it within what Vertex will accept for this model while
 * still giving the schema-constrained tool-call step a clean shot.
 */
function thinkingProviderOptions(disableThinking: boolean | undefined, modelString: string) {
  if (!disableThinking || !modelString.startsWith('google/')) return undefined;
  if (modelString === 'google/gemini-2.5-pro') {
    return { vertex: { thinkingConfig: { thinkingBudget: 128 } } };
  }
  return { vertex: { thinkingConfig: { thinkingBudget: 0 } } };
}

export interface GenerateTextArgs {
  /** Format: `provider/model`, e.g. `anthropic/claude-sonnet-4-5@20250929`. */
  model: string;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** See `thinkingProviderOptions` above. Ignored for `anthropic/*` models. */
  disableThinking?: boolean;
}

export interface GenerateTextResult {
  text: string;
  usage: LanguageModelUsage;
}

export async function generateText(args: GenerateTextArgs): Promise<GenerateTextResult> {
  const providerOptions = thinkingProviderOptions(args.disableThinking, args.model);
  const result = await aiGenerateText({
    model: resolveModel(args.model),
    prompt: args.prompt,
    abortSignal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    ...(args.system !== undefined && { system: args.system }),
    ...(args.maxOutputTokens !== undefined && { maxOutputTokens: args.maxOutputTokens }),
    ...(args.temperature !== undefined && { temperature: args.temperature }),
    ...(providerOptions !== undefined && { providerOptions }),
  });
  return { text: result.text, usage: result.usage };
}

export interface GenerateObjectArgs<T> {
  model: string;
  schema: ZodSchema<T>;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  schemaName?: string;
  schemaDescription?: string;
  /** See `thinkingProviderOptions` above. Ignored for `anthropic/*` models. */
  disableThinking?: boolean;
}

export interface GenerateObjectResult<T> {
  object: T;
  usage: LanguageModelUsage;
}

export async function generateObject<T>(
  args: GenerateObjectArgs<T>,
): Promise<GenerateObjectResult<T>> {
  const providerOptions = thinkingProviderOptions(args.disableThinking, args.model);
  const result = await aiGenerateObject({
    model: resolveModel(args.model),
    schema: args.schema,
    prompt: args.prompt,
    abortSignal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    ...(args.system !== undefined && { system: args.system }),
    ...(args.maxOutputTokens !== undefined && { maxOutputTokens: args.maxOutputTokens }),
    ...(args.schemaName !== undefined && { schemaName: args.schemaName }),
    ...(args.schemaDescription !== undefined && { schemaDescription: args.schemaDescription }),
    ...(providerOptions !== undefined && { providerOptions }),
  });
  return { object: result.object as T, usage: result.usage };
}

/**
 * `generateObject` failures were, until this, logged as a single flat
 * "No object generated: could not parse the response" string — the SDK's
 * `NoObjectGeneratedError` actually carries `finishReason` (was the
 * response truncated by the token budget, or did the model just produce
 * something invalid?) and, when the failure is a schema mismatch rather
 * than unparseable JSON, a Zod `cause` naming exactly which field(s)
 * failed and why. That's the difference between "some transient LLM
 * flakiness" and "we're asking for something the model can't reliably
 * produce" — worth surfacing, but only the shape of the failure, never
 * response content: this app's LLM responses are resume/cover-letter
 * text seeded from a real user's profile, so no field here should ever
 * carry response text or the concrete (potentially PII-bearing) value
 * that failed validation, only path/code/length/finishReason.
 *
 * Returns undefined for any other error shape — callers should fall
 * back to logging the plain message.
 */
export function extractGenerateObjectDiagnostics(
  err: unknown,
): Record<string, unknown> | undefined {
  if (!NoObjectGeneratedError.isInstance(err)) return undefined;
  const diagnostics: Record<string, unknown> = {
    finishReason: err.finishReason,
    responseTextLength: err.text?.length ?? null,
  };
  if (err.cause instanceof ZodError) {
    diagnostics.zodIssues = err.cause.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    }));
  }
  return diagnostics;
}
