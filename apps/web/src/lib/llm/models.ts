import type { Tier } from '@/lib/billing/limits';

/**
 * Model catalog. `id` is the `provider/model` string the provider wrapper
 * understands. `minTier` is the lowest tier that can pick this model —
 * gating is enforced by `resolveModelForUser`, not here.
 *
 * Models are served via GCP Vertex AI, region `GOOGLE_VERTEX_LOCATION`
 * (europe-west1 — see env.ts; matches the EU data-residency commitment
 * in the privacy policy, so don't casually change it).
 *
 * ⚠️ 2026-07-18: every Anthropic (Claude) model is commented out below.
 * This is NOT a model-version or region problem — it's that the
 * `anthropic` publisher has never been enabled for this GCP project's
 * Vertex AI Model Garden. Confirmed by testing the *actual inference*
 * endpoint (`:rawPredict`), not just the metadata endpoint
 * (`publishers/anthropic/models/{id}` GET) — metadata returns 200/403
 * inconsistently across models and looks like a region issue, but real
 * inference on claude-sonnet-4-5@20250929 (the one model whose metadata
 * WAS visible in europe-west1, previously assumed working) 404s in
 * europe-west1, us-central1, AND us-east5 alike: "Publisher model ...
 * was not found or your project does not have access to it." Gemini
 * (Google's own first-party models, no Model Garden opt-in needed)
 * succeeds on the same real-inference test in the same region. That
 * combination — visible metadata, 404 on every region for actual
 * calls, first-party Google models fine — is the signature of "never
 * entitled," not "wrong id" or "not rolled out here yet."
 *
 * Fix (one-time, in GCP Console, not from code): Vertex AI → Model
 * Garden → find Anthropic Claude → Enable. Once that's done, uncomment
 * the entries below — the ids themselves are current and correct as of
 * 2026-07-18 (claude-sonnet-4-5@20250929, claude-opus-4-1@20250805).
 * Newer generations (claude-haiku-4-5, claude-sonnet-5, claude-opus-4-8)
 * additionally need us-central1 specifically (not yet rolled out to any
 * EU region as of this check) — genuinely a separate, later problem
 * from the entitlement one, worth re-checking after Model Garden is
 * enabled rather than assumed fixed by the same step.
 *
 * Until then the whole app — every tier — runs on Gemini. That's a
 * real product gap (the marketing site says "Powered by Claude AI")
 * worth fixing in the Console sooner rather than later, not just a
 * config nit.
 *
 * Keep the catalog small. Each addition is a Hebrew + English string in
 * translations, a side trip through tier-gate logic, and one more option
 * a user has to grok.
 */
export interface CatalogEntry {
  id: string;
  provider: 'anthropic' | 'google';
  /** Short display name shown in the picker card title. */
  displayName: string;
  /** One-line marketing description in English (Hebrew lives in i18n). */
  blurbEn: string;
  /** Lowest tier that can select this model. */
  minTier: Tier;
  /** Currently recommended default — shows a badge in the picker. */
  recommended?: boolean;
}

export const MODEL_CATALOG: readonly CatalogEntry[] = [
  // Anthropic publisher not yet enabled in this GCP project's Vertex AI
  // Model Garden — see file header. Uncomment once that's done in the
  // Console; these two ids are otherwise correct and current.
  // {
  //   id: 'anthropic/claude-sonnet-4-5@20250929',
  //   provider: 'anthropic',
  //   displayName: 'Claude Sonnet 4.5',
  //   blurbEn: 'Balanced — best general quality for the price.',
  //   minTier: 'plus',
  // },
  // {
  //   id: 'anthropic/claude-opus-4-1@20250805',
  //   provider: 'anthropic',
  //   displayName: 'Claude Opus 4.1',
  //   blurbEn: 'Highest quality — slower, premium output.',
  //   minTier: 'pro',
  // },
  {
    id: 'google/gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
    blurbEn: 'Strong multilingual and structured output.',
    minTier: 'plus',
    recommended: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    provider: 'google',
    displayName: 'Gemini 2.5 Flash',
    blurbEn: 'Fast Gemini variant — cheap for batch parsing.',
    minTier: 'free',
  },
] as const;

/** Look up an entry by id. */
export function getModelById(id: string): CatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/**
 * The model used when a user has no preference set — depends on tier
 * because Free is locked to the cheapest option. Plus/Pro would default
 * to Claude Sonnet once the Anthropic Model Garden entitlement is fixed
 * (see file header) — anthropic/claude-sonnet-4-5@20250929 is the id to
 * restore here.
 */
export function getTierDefault(tier: Tier): string {
  if (tier === 'free') return 'google/gemini-2.5-flash';
  return 'google/gemini-2.5-pro';
}
