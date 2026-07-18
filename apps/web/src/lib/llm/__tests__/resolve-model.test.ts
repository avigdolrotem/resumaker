import { describe, it, expect, vi } from 'vitest';
import { resolveModel } from '../resolve-model';

// Catalog is Gemini-only right now — Anthropic is commented out in
// models.ts pending a Vertex AI Model Garden entitlement fix (see the
// long comment there). SONNET/OPUS below are deliberately NOT in the
// live catalog, so they exercise the same "unknown id → tier default"
// branch as a typo would. Once Claude entries are restored, add back a
// dedicated "known model, but requires a higher tier" case (e.g. a plus
// user picking a pro-only Opus should still fall back to the tier
// default, not succeed) — that branch has no live coverage right now
// because both current catalog entries only require 'free' or 'plus',
// and every tier that can choose at all (plus, pro) clears 'plus'.
const FREE_DEFAULT = 'google/gemini-2.5-flash';
const PLUS_PRO_DEFAULT = 'google/gemini-2.5-pro';
const SONNET = 'anthropic/claude-sonnet-4-5@20250929';
const GEMINI_PRO = 'google/gemini-2.5-pro';

describe('resolveModel — pure resolver', () => {
  it('free user with no preference → tier default', () => {
    expect(resolveModel({ tier: 'free', preference: null })).toBe(FREE_DEFAULT);
  });

  it('free user with a preference for Sonnet → ignored, returns tier default (no canChooseLLM)', () => {
    expect(resolveModel({ tier: 'free', preference: SONNET })).toBe(FREE_DEFAULT);
  });

  it('plus user with no preference → tier default', () => {
    expect(resolveModel({ tier: 'plus', preference: null })).toBe(PLUS_PRO_DEFAULT);
  });

  it('plus user picks Gemini → Gemini', () => {
    expect(resolveModel({ tier: 'plus', preference: GEMINI_PRO })).toBe(GEMINI_PRO);
  });

  it('unknown preference id → tier default', () => {
    expect(resolveModel({ tier: 'pro', preference: 'nope/nope' })).toBe(PLUS_PRO_DEFAULT);
  });

  it('preference for a currently-unavailable (commented-out) model → tier default', () => {
    expect(resolveModel({ tier: 'pro', preference: SONNET })).toBe(PLUS_PRO_DEFAULT);
  });
});

vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: { users: { id: 'id' } },
}));

vi.mock('@/lib/billing/tier', () => ({
  getUserTier: vi.fn(),
  canChooseLLM: (tier: 'free' | 'plus' | 'pro') => ({
    allowed: tier !== 'free',
  }),
}));

import { db } from '@/db';
import { getUserTier } from '@/lib/billing/tier';
import { resolveModelForUser } from '../resolve-model';

describe('resolveModelForUser (DB-backed)', () => {
  it('plus user with Gemini preference → Gemini', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('plus');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      llmModel: GEMINI_PRO,
    } as never);
    expect(await resolveModelForUser('u1')).toBe(GEMINI_PRO);
  });

  it('free user with Sonnet preference → tier default (locked)', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('free');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      llmModel: SONNET,
    } as never);
    expect(await resolveModelForUser('u1')).toBe(FREE_DEFAULT);
  });

  it('no preference row → tier default', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('pro');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined);
    expect(await resolveModelForUser('u1')).toBe(PLUS_PRO_DEFAULT);
  });
});
