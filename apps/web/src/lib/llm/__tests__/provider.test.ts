import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock the AI SDK so we can test our wrapper without a network call.
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/google-vertex', () => ({
  vertex: (id: string) => ({ __model: `google/${id}` }),
}));
vi.mock('@ai-sdk/google-vertex/anthropic', () => ({
  vertexAnthropic: (id: string) => ({ __model: `anthropic/${id}` }),
}));

import * as ai from 'ai';
import { generateText, generateObject } from '../provider';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provider.generateText', () => {
  it('passes prompt + system to ai-sdk and returns text', async () => {
    (ai.generateText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: 'hello',
      usage: { inputTokens: 5, outputTokens: 1, totalTokens: 6 },
    });

    const result = await generateText({
      model: 'anthropic/claude-sonnet-4-5@20250929',
      system: 'be brief',
      prompt: 'say hi',
      maxOutputTokens: 100,
    });

    expect(result.text).toBe('hello');
    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { __model: 'anthropic/claude-sonnet-4-5@20250929' },
        system: 'be brief',
        prompt: 'say hi',
        maxOutputTokens: 100,
      }),
    );
  });

  it('surfaces usage tokens', async () => {
    (ai.generateText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: 'x',
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });
    const result = await generateText({
      model: 'anthropic/claude-sonnet-4-5@20250929',
      prompt: '.',
    });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
  });
});

describe('provider.generateObject', () => {
  it('passes Zod schema through and returns parsed object', async () => {
    const Schema = z.object({ score: z.number() });
    (ai.generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: { score: 7 },
      usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
    });

    const result = await generateObject({
      model: 'anthropic/claude-sonnet-4-5@20250929',
      schema: Schema,
      prompt: 'score it',
    });

    expect(result.object).toEqual({ score: 7 });
    expect(ai.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: Schema,
        model: { __model: 'anthropic/claude-sonnet-4-5@20250929' },
      }),
    );
  });
});
