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

// Catalog is Gemini-only right now — Anthropic is commented out in
// lib/llm/models.ts pending a Vertex AI Model Garden entitlement fix
// (see the long comment there). claude-opus-4-1@20250805 below is
// deliberately NOT in the live catalog, so "picking a pro-only model as
// a plus user" (402, tier_gate) has no live coverage until Claude
// entries are restored — right now that id just 400s as unknown, same
// as a typo would. Add a dedicated 402 case back once Opus returns.
describe('PATCH /api/user/llm-model', () => {
  it('rejects an id that is not in the (currently Gemini-only) catalog', async () => {
    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'anthropic/claude-opus-4-1@20250805' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('stores a model the tier can pick (Plus → Gemini Pro)', async () => {
    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'google/gemini-2.5-pro' }),
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

  it('rejects free user trying to choose a plus-tier model', async () => {
    const tierMod = await import('@/lib/billing/tier');
    vi.mocked(tierMod.getUserTier).mockResolvedValueOnce('free');

    const req = new NextRequest('http://localhost/api/user/llm-model', {
      method: 'PATCH',
      body: JSON.stringify({ llmModel: 'google/gemini-2.5-pro' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(402);
  });
});
