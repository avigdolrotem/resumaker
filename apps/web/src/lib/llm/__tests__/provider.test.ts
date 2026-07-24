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

describe('provider thinkingProviderOptions (via disableThinking)', () => {
  const Schema = z.object({ x: z.number() });

  beforeEach(() => {
    (ai.generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { x: 1 },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
  });

  it('disables thinking entirely for flash', async () => {
    await generateObject({
      model: 'google/gemini-2.5-flash',
      schema: Schema,
      prompt: '.',
      disableThinking: true,
    });
    expect(ai.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { vertex: { thinkingConfig: { thinkingBudget: 0 } } },
      }),
    );
  });

  // Regression test: Vertex rejects thinkingBudget:0 for gemini-2.5-pro
  // outright ("The model does not support setting thinking_budget to
  // 0"), which made every disableThinking caller — resume generation
  // chief among them — 100% fail whenever a user had Pro selected, with
  // zero test coverage catching it. Pro needs a small non-zero budget
  // instead (verified live: omitting thinkingConfig entirely produces
  // an unparseable response; 0 is rejected outright; a small positive
  // value works).
  it('uses a small non-zero budget for pro instead of 0', async () => {
    await generateObject({
      model: 'google/gemini-2.5-pro',
      schema: Schema,
      prompt: '.',
      disableThinking: true,
    });
    const call = (ai.generateObject as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      providerOptions?: { vertex?: { thinkingConfig?: { thinkingBudget?: number } } };
    };
    const budget = call.providerOptions?.vertex?.thinkingConfig?.thinkingBudget;
    expect(budget).toBeGreaterThan(0);
  });

  it('leaves anthropic models untouched regardless of disableThinking', async () => {
    await generateObject({
      model: 'anthropic/claude-sonnet-4-5@20250929',
      schema: Schema,
      prompt: '.',
      disableThinking: true,
    });
    const call = (ai.generateObject as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      providerOptions?: unknown;
    };
    expect(call.providerOptions).toBeUndefined();
  });
});
