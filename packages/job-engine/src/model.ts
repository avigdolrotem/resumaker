import { vertex } from '@ai-sdk/google-vertex';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';

/**
 * Resolve `provider/model` to a Vertex-backed AI SDK model. Was
 * duplicated identically in fit-score.ts and importer.ts — consolidated
 * after the duplication itself caused a real bug: the disableThinking
 * fix from apps/web/src/lib/llm/provider.ts (see thinkingProviderOptions
 * below) was applied there but never propagated to either of this
 * package's own copies, and computeFitScore silently hit its internal
 * failure fallback 3 times out of 4 in one live run as a result. Fixing
 * one copy and forgetting the other is exactly the failure mode a single
 * shared function removes.
 */
export function resolveModel(modelString: string) {
  const slash = modelString.indexOf('/');
  if (slash === -1) throw new Error(`Invalid model string "${modelString}"`);
  const provider = modelString.slice(0, slash);
  const modelId = modelString.slice(slash + 1);
  if (provider === 'anthropic') return vertexAnthropic(modelId);
  if (provider === 'google') return vertex(modelId);
  throw new Error(`Unsupported provider "${provider}"`);
}

/**
 * Gemini 2.5's default "thinking" spends tokens from the same
 * maxOutputTokens budget as the visible response, before any of it —
 * this package's own version of thinkingProviderOptions in
 * apps/web/src/lib/llm/provider.ts (duplicated, not shared, since apps
 * depend on packages and not the reverse). Always pass this as
 * providerOptions for a bounded single-shot structured-output call on a
 * google/* model; harmless no-op for anthropic/* models.
 */
export function thinkingProviderOptions(modelString: string) {
  if (!modelString.startsWith('google/')) return undefined;
  return { vertex: { thinkingConfig: { thinkingBudget: 0 } } };
}
