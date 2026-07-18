import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm/provider', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@resumaker/ai-safety', () => ({
  sanitizeInput: (s: string) => ({ rejected: false, cleaned: s, detections: [] }),
  buildPrompt: () => ({ system: 'SYS', user: 'USER' }),
  validateOutput: (o: unknown) => ({ valid: true, resume: o, errors: [], warnings: [] }),
}));

const returningMock = vi.fn().mockResolvedValue([{ id: 'gen-1' }]);
vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: () => ({ returning: returningMock }),
    }),
  },
  schema: { generations: {} },
}));

import * as provider from '@/lib/llm/provider';
import { generateResume } from '../llm';

beforeEach(() => {
  vi.clearAllMocks();
});

const FAKE_RESUME = {
  metadata: { language: 'en', generated_at: '2026-05-25T00:00:00Z', template: 'modern' },
  contact: { name: 'T' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
};

describe('generateResume', () => {
  it('uses env.DEFAULT_LLM_MODEL when modelString not provided', async () => {
    vi.mocked(provider.generateObject).mockResolvedValueOnce({
      object: FAKE_RESUME,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as never);

    await generateResume({
      userId: 'u1',
      locale: 'en',
      jobDescription: 'JD',
      userProfile: {},
    });

    // env.DEFAULT_LLM_MODEL is Gemini right now, not Anthropic — see the
    // long comment in lib/llm/models.ts (Vertex AI Model Garden isn't
    // enabled for the Anthropic publisher on this GCP project yet).
    expect(vi.mocked(provider.generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringMatching(/^google\//) }),
    );
  });

  it('uses provided modelString when supplied', async () => {
    vi.mocked(provider.generateObject).mockResolvedValueOnce({
      object: FAKE_RESUME,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as never);

    await generateResume({
      userId: 'u1',
      locale: 'en',
      jobDescription: 'JD',
      userProfile: {},
      modelString: 'google/gemini-2.5-pro',
    });

    expect(vi.mocked(provider.generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemini-2.5-pro' }),
    );
  });
});
