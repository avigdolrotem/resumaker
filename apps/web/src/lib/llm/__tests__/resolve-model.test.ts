import { describe, it, expect } from 'vitest';
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
