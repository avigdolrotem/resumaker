import { describe, it, expect, vi } from 'vitest';
import { resolveModel } from '../resolve-model';

describe('resolveModel — pure resolver', () => {
  it('free user with no preference → Haiku', () => {
    expect(resolveModel({ tier: 'free', preference: null })).toBe('anthropic/claude-haiku-4-5');
  });

  it('free user with a preference for Sonnet → ignored, returns Haiku (no canChooseLLM)', () => {
    expect(resolveModel({ tier: 'free', preference: 'anthropic/claude-sonnet-4-6' })).toBe(
      'anthropic/claude-haiku-4-5',
    );
  });

  it('plus user with no preference → Sonnet', () => {
    expect(resolveModel({ tier: 'plus', preference: null })).toBe('anthropic/claude-sonnet-4-6');
  });

  it('plus user picks Gemini → Gemini', () => {
    expect(resolveModel({ tier: 'plus', preference: 'google/gemini-2.5-pro' })).toBe(
      'google/gemini-2.5-pro',
    );
  });

  it('plus user picks Opus (Pro-only) → falls back to Sonnet', () => {
    expect(resolveModel({ tier: 'plus', preference: 'anthropic/claude-opus-4-7' })).toBe(
      'anthropic/claude-sonnet-4-6',
    );
  });

  it('pro user picks Opus → Opus', () => {
    expect(resolveModel({ tier: 'pro', preference: 'anthropic/claude-opus-4-7' })).toBe(
      'anthropic/claude-opus-4-7',
    );
  });

  it('unknown preference id → tier default', () => {
    expect(resolveModel({ tier: 'pro', preference: 'nope/nope' })).toBe(
      'anthropic/claude-sonnet-4-6',
    );
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
      llmModel: 'google/gemini-2.5-pro',
    } as never);
    expect(await resolveModelForUser('u1')).toBe('google/gemini-2.5-pro');
  });

  it('free user with Sonnet preference → Haiku (locked)', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('free');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      llmModel: 'anthropic/claude-sonnet-4-6',
    } as never);
    expect(await resolveModelForUser('u1')).toBe('anthropic/claude-haiku-4-5');
  });

  it('no preference row → tier default', async () => {
    vi.mocked(getUserTier).mockResolvedValueOnce('pro');
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined);
    expect(await resolveModelForUser('u1')).toBe('anthropic/claude-sonnet-4-6');
  });
});
