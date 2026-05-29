/**
 * Thin `fetch` wrapper for tier-gated API calls.
 *
 * Server-side, every tier limit is enforced by `lib/billing/tier.ts` and
 * surfaced as `HTTP 402 Payment Required` with a body shaped like:
 *
 *   { code: 'TIER_LIMIT',
 *     reasonKey: 'billing.gate.resume_limit',
 *     requiredTier: 'plus',
 *     current, limit }
 *
 * or, for the LLM model picker:
 *
 *   { error: 'tier_gate', feature: 'model_choice', requiredTier: 'pro' }
 *
 * Every client component that calls a potentially-tier-gated endpoint
 * should use `apiFetch` instead of the bare `fetch`. On 402, we:
 *   1. Parse the body and resolve a canonical `FeatureGateName`.
 *   2. Dispatch a global `apiclient:402` CustomEvent — picked up by the
 *      <ApiUpgradeListener /> mounted in the (app) layout, which opens
 *      the existing UpgradeModal.
 *   3. Throw an `ApiTierError` so the caller can abort cleanly without
 *      double-prompting the user.
 *
 * Non-402 responses pass through unchanged (same shape as native fetch).
 */

import type { FeatureGateName } from '@/components/upgrade-modal';

/** Custom-event name dispatched on the window when a 402 is intercepted. */
export const API_GATE_EVENT = 'apiclient:402';

export interface ApiGateDetail {
  feature: FeatureGateName;
  requiredTier: 'plus' | 'pro';
}

/**
 * Thrown by `apiFetch` when the response is 402. The global listener
 * has already opened the modal by the time this is thrown, so callers
 * just need to catch it and stop their flow (no extra UI work).
 */
export class ApiTierError extends Error {
  readonly feature: FeatureGateName;
  readonly requiredTier: 'plus' | 'pro';
  constructor(feature: FeatureGateName, requiredTier: 'plus' | 'pro') {
    super(`Tier gate: ${feature}`);
    this.name = 'ApiTierError';
    this.feature = feature;
    this.requiredTier = requiredTier;
  }
}

// Strict allow-list — anything outside this set falls back to
// `resume_limit` (a reasonable generic gate copy). Keeps the modal's
// `feature` prop typed and prevents stray strings driving the i18n
// lookup.
const FEATURE_NAMES: ReadonlySet<FeatureGateName> = new Set<FeatureGateName>([
  'model_choice',
  'cover_letter',
  'resume_limit',
  'generation_limit',
  'template_locked',
  'job_hunt_beta',
]);

const REASON_TO_FEATURE: Record<string, FeatureGateName> = {
  'billing.gate.resume_limit': 'resume_limit',
  'billing.gate.generation_limit': 'generation_limit',
  'billing.gate.cover_letter_limit': 'cover_letter',
  'billing.gate.cover_letter_disabled': 'cover_letter',
  'billing.gate.model_choice': 'model_choice',
  'billing.gate.template_locked': 'template_locked',
};

function resolveFeature(body: Record<string, unknown> | null): FeatureGateName {
  if (!body) return 'resume_limit';
  // Server's `feature` field (e.g. /api/user/llm-model) — preferred when present.
  const direct = typeof body.feature === 'string' ? body.feature : null;
  if (direct && FEATURE_NAMES.has(direct as FeatureGateName)) {
    return direct as FeatureGateName;
  }
  // Otherwise map from reasonKey.
  const reason = typeof body.reasonKey === 'string' ? body.reasonKey : null;
  if (reason && REASON_TO_FEATURE[reason]) return REASON_TO_FEATURE[reason]!;
  return 'resume_limit';
}

function resolveRequiredTier(body: Record<string, unknown> | null): 'plus' | 'pro' {
  if (!body) return 'plus';
  return body.requiredTier === 'pro' ? 'pro' : 'plus';
}

/**
 * Drop-in `fetch` replacement that intercepts 402s and dispatches the
 * upgrade-modal event. Same signature, same return type for the
 * 2xx/4xx/5xx paths so it's a one-line migration.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 402) return res;

  // Clone before reading so callers that catch the error can still
  // read the response body if they need to (e.g. for telemetry).
  const cloned = res.clone();
  let body: Record<string, unknown> | null = null;
  try {
    body = (await cloned.json()) as Record<string, unknown>;
  } catch {
    /* malformed body — fall through with sensible defaults */
  }

  const detail: ApiGateDetail = {
    feature: resolveFeature(body),
    requiredTier: resolveRequiredTier(body),
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ApiGateDetail>(API_GATE_EVENT, { detail }));
  }
  throw new ApiTierError(detail.feature, detail.requiredTier);
}
