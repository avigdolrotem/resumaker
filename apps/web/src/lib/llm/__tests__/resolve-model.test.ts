import { describe, it, expect, vi } from 'vitest';
import { resolveModel } from '../resolve-model';

const HAIKU = 'anthropic/claude-haiku-4-5@20251001';
const SONNET = 'anthropic/claude-sonnet-4-5@20250929';
const OPUS = 'anthropic/claude-opus-4@20250515';
const GEMINI_PRO = 'google/gemini-2.5-pro';

describe('resolveModel — pure resolver', () => {
  it('free user with no preference → Haiku', () => {
    expect(resolveModel({ tier: 'free', preference: null })).toBe(HAIKU);
  });

  it('free user with a preference for Sonnet → ignored, returns Haiku (no canChooseLLM)', () => {
    expect(resolveModel({ tier: 'free', preference: SONNET })).toBe(HAIKU);
  });

  it('plus user with no preference → Sonnet', () => {
    expect(resolveModel({ tier: 'plus', preference: null })).toBe(SONNET);
  });

  it('plus user picks Gemini → Gemini', () => {
    expect(resolveModel({ tier: 'plus', preference: GEMINI_PRO })).toBe(GEMINI_PRO);
  });

  it('plus user picks Opus (Pro-only) → falls back to Sonnet', () => {
    expect(resolveModel({ tier: 'plus', preference: OPUS })).toBe(SONNET);
  });

  it('pro user picks Opus → Opus', () => {
    expect(resolveModel({ tier: 'pro', preference: OPUS })).toBe(OPUS);
  });

  it('unknown preference id → tier default', () => {
    expect(resolveModel({ tier: 'pro', preference: 'nope/nope' })).toBe(SONNET);
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

  it('free user with Sonnet preference → Haiku (locked)', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('free');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      llmModel: SONNET,
    } as never);
    expect(await resolveModelForUser('u1')).toBe(HAIKU);
  });

  it('no preference row → tier default', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('pro');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined);
    expect(await resolveModelForUser('u1')).toBe(SONNET);
  });
});
