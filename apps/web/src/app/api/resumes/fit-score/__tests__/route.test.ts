import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

// Mock next/headers so headers() works outside a Next.js request scope.
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/llm/provider', () => ({
  generateObject: vi.fn(),
}));

// The route now goes through requireActiveUser (which also rejects
// suspended/soft-deleted accounts) rather than reading the session
// directly, so that's what needs stubbing.
vi.mock('@/lib/auth-guards', () => ({
  requireActiveUser: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetSeconds: 3600 }),
}));

vi.mock('@/db', () => ({
  db: { query: { profiles: { findFirst: findFirstMock } } },
  schema: { profiles: { userId: 'user_id' } },
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
  // Matches ProfileContentSchema (ResumeSchema.omit({ metadata: true })) —
  // the shape /api/resumes/generate and /api/resumes/score both read.
  findFirstMock.mockResolvedValue({
    content: {
      contact: { name: 'Test' },
      summary: 'Engineer',
      experience: [],
      education: [],
      skills: ['TypeScript'],
    },
    onboardingCompletedAt: new Date('2026-05-25T00:00:00Z'),
  });
});

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/resumes/fit-score', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/resumes/fit-score', () => {
  it('returns structured fit-score object from generateObject', async () => {
    vi.mocked(llm.generateObject).mockResolvedValueOnce({
      object: {
        score: 7,
        missing_keywords: ['Kubernetes'],
        strengths: ['TypeScript'],
        rationale: 'Solid baseline match.',
      },
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
    } as never);

    const res = await POST(makeReq({ jobDescription: 'We need a TypeScript engineer.' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score).toBe(7);
    expect(data.missing_keywords).toEqual(['Kubernetes']);
    expect(vi.mocked(llm.generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringMatching(/^[a-z]+\/[a-z0-9.@\-]+$/),
      }),
    );
  });

  it('returns 401 without a session', async () => {
    vi.mocked(guards.requireActiveUser).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never,
    );
    const res = await POST(makeReq({ jobDescription: 'x'.repeat(20) }));
    expect(res.status).toBe(401);
  });

  it('returns 409 NO_PROFILE when the caller has no completed profile', async () => {
    findFirstMock.mockResolvedValueOnce(undefined);
    const res = await POST(makeReq({ jobDescription: 'x'.repeat(20) }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.code).toBe('NO_PROFILE');
  });
});
