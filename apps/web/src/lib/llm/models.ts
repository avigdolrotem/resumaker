import type { Tier } from '@/lib/billing/limits';

/**
 * Model catalog. `id` is the Vercel AI Gateway string. `minTier` is the
 * lowest tier that can pick this model — gating is enforced by
 * `resolveModelForUser`, not here.
 *
 * Keep the catalog small. Each addition is a Hebrew + English string in
 * translations, a side trip through tier-gate logic, and one more option
 * a user has to grok. Add only when there's a clear reason.
 */
export interface CatalogEntry {
  id: string;
  provider: 'anthropic' | 'google' | 'openai';
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
  {
    id: 'anthropic/claude-haiku-4-5',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    blurbEn: 'Fastest and cheapest — good baseline quality.',
    minTier: 'free',
  },
  {
    id: 'anthropic/claude-sonnet-4-6',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.6',
    blurbEn: 'Balanced — best general quality for the price.',
    minTier: 'plus',
    recommended: true,
  },
  {
    id: 'anthropic/claude-opus-4-7',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.7',
    blurbEn: 'Highest quality — slower, premium output.',
    minTier: 'pro',
  },
  {
    id: 'google/gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
    blurbEn: 'Strong multilingual and structured output.',
    minTier: 'plus',
  },
  {
    id: 'openai/gpt-5',
    provider: 'openai',
    displayName: 'GPT-5',
    blurbEn: 'OpenAI flagship — great long-context reasoning.',
    minTier: 'plus',
  },
] as const;

const TIER_ORDER: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

/** Models the given tier can pick. */
export function getModelsForTier(tier: Tier): CatalogEntry[] {
  return MODEL_CATALOG.filter((m) => TIER_ORDER[tier] >= TIER_ORDER[m.minTier]);
}

/** Look up an entry by gateway id. */
export function getModelById(id: string): CatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/**
 * The model used when a user has no preference set — depends on tier
 * because Free is locked to Haiku.
 */
export function getTierDefault(tier: Tier): string {
  if (tier === 'free') return 'anthropic/claude-haiku-4-5';
  return 'anthropic/claude-sonnet-4-6';
}
