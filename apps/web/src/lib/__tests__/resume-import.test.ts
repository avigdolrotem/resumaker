import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm/provider', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@resumaker/ai-safety', () => ({
  sanitizeInput: (s: string) => ({ rejected: false, cleaned: s, detections: [] }),
}));

import * as llm from '@/lib/llm/provider';
import { parseResumeText } from '../resume-import';

beforeEach(() => vi.clearAllMocks());

describe('parseResumeText', () => {
  it('returns the parsed profile from generateObject', async () => {
    vi.mocked(llm.generateObject).mockResolvedValueOnce({
      object: { name: 'Alice', email: 'a@b.com', skills: ['TS'] },
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
    } as never);

    const profile = await parseResumeText('Alice — TypeScript engineer — a@b.com');
    expect(profile.name).toBe('Alice');
    expect(profile.skills).toEqual(['TS']);
    expect(vi.mocked(llm.generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringMatching(/^[a-z]+\/[a-z0-9.\-]+$/),
      }),
    );
  });
});
