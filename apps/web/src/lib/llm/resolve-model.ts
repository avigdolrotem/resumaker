import type { Tier } from '@/lib/billing/limits';
import { canChooseLLM, getUserTier } from '@/lib/billing/tier';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getModelById, getTierDefault } from './models';

interface ResolveArgs {
  tier: Tier;
  preference: string | null;
}

/**
 * Pure function that turns (tier, preference) into the model string the
 * LLM call should actually use.
 *
 * Why: storing the user's preference outlives their subscription. A user
 * who picks Opus on Pro and later downgrades to Plus shouldn't get a 402
 * — they should silently fall back to the best model their current tier
 * allows. Same idea if the catalog drops a model entry: unknown id →
 * tier default, not crash.
 */
export function resolveModel({ tier, preference }: ResolveArgs): string {
  if (!canChooseLLM(tier).allowed) return getTierDefault(tier);
  if (!preference) return getTierDefault(tier);
  const entry = getModelById(preference);
  if (!entry) return getTierDefault(tier);
  // Tier check: model.minTier must be <= user tier.
  const tierOrder = { free: 0, plus: 1, pro: 2 } as const;
  if (tierOrder[tier] < tierOrder[entry.minTier]) return getTierDefault(tier);
  return preference;
}

/**
 * Full resolution for a given userId: look up their tier, look up
 * their stored preference, run it through the pure `resolveModel`,
 * and return the gateway-format model string the LLM call should use.
 */
export async function resolveModelForUser(userId: string): Promise<string> {
  const tier = await getUserTier(userId);
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { llmModel: true },
  });
  return resolveModel({ tier, preference: row?.llmModel ?? null });
}
