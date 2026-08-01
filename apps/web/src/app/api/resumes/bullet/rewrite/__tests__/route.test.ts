import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock next/headers so headers() works outside a Next.js request scope.
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock provider so we don't hit a real LLM.
vi.mock('@/lib/llm/provider', () => ({
  generateText: vi.fn(),
}));

// Mock auth so we get a fake session.
vi.mock('@/lib/auth-guards', () => ({
  requireActiveUser: vi.fn(),
}));

// Mock rate limit so it always passes.
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetSeconds: 3600 }),
}));

// Mock tier so user is plus.
vi.mock('@/lib/billing/tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('plus'),
}));

import * as llm from '@/lib/llm/provider';
import * as guards from '@/lib/auth-guards';
import { POST } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(guards.requireActiveUser).mockResolvedValue({
    session: {},
    user: { id: 'u1', role: 'user' },
  } as never);
});

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/resumes/bullet/rewrite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/resumes/bullet/rewrite', () => {
  it('rewrites a bullet using the fallback model and returns the result', async () => {
    vi.mocked(llm.generateText).mockResolvedValueOnce({
      text: 'Led a 10-person team to launch X 2 quarters ahead of schedule.',
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
    } as never);

    const res = await POST(makeReq({ bullet: 'Led a team', tone: 'impact' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bullet).toContain('Led');
    expect(vi.mocked(llm.generateText)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringMatching(/^[a-z]+\/[a-z0-9.@\-]+$/),
        prompt: expect.stringContaining('Led a team'),
      }),
    );
  });

  it('returns 401 without a session', async () => {
    vi.mocked(guards.requireActiveUser).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never,
    );
    const res = await POST(makeReq({ bullet: 'x' }));
    expect(res.status).toBe(401);
  });
});
