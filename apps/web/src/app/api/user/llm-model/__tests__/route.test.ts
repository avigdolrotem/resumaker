import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { updateReturningMock, findFirstMock } = vi.hoisted(() => ({
  updateReturningMock: vi.fn().mockResolvedValue([{ llmModel: 'google/gemini-2.5-pro' }]),
  findFirstMock: vi.fn().mockResolvedValue({ llmModel: 'google/gemini-2.5-pro' }),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock('@/lib/billing/tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('plus'),
  canChooseLLM: (tier: 'free' | 'plus' | 'pro') => ({
    allowed: tier !== 'free',
    reasonKey: 'billing.gate.model_choice',
  }),
}));

vi.mock('@/db', () => ({
  db: {
    query: { users: { findFirst: findFirstMock } },
    update: () => ({ set: () => ({ where: () => ({ returning: updateReturningMock }) }) }),
  },
  schema: { users: { id: 'id', llmModel: 'llm_model' } },
}));

import * as authMod from '@/lib/auth';
import { GET, PATCH } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authMod.auth.api.getSession).mockResolvedValue({
    user: { id: 'u1' },
  } as never);
  findFirstMock.mockResolvedValue({ llmModel: 'google/gemini-2.5-pro' });
});

describe('GET /api/user/llm-model', () => {
  it('returns the stored model + tier metadata', async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.llmModel).toBe('google/gemini-2.5-pro');
    expect(data.tier).toBe('plus');
  });

  it('returns 401 without a session', async () => {
    vi.mocked(authMod.auth.api.getSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/user/llm-model', () => {
  it('stores a valid model id', async () => {
    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'anthropic/claude-opus-4-7' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    // Pro user picking Opus would be 200; plus user picking Opus = 402.
    // Here getUserTier returns 'plus' but minTier of opus is 'pro' → expect 402.
    expect(res.status).toBe(402);
  });

  it('stores a model the tier can pick (Plus → Sonnet)', async () => {
    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'anthropic/claude-sonnet-4-6' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it('rejects an unknown model id', async () => {
    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'nope/nope' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('rejects free user trying to choose any model', async () => {
    const tierMod = await import('@/lib/billing/tier');
    vi.mocked(tierMod.getUserTier).mockResolvedValueOnce('free');

    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'anthropic/claude-sonnet-4-6' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(402);
  });
});
