import { describe, it, expect } from 'vitest';
import { MODEL_CATALOG, getModelsForTier, getModelById, getTierDefault } from '../models';

describe('LLM model catalog', () => {
  it('contains at least 5 models', () => {
    expect(MODEL_CATALOG.length).toBeGreaterThanOrEqual(5);
  });

  it('every model has a provider/model id', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.id).toMatch(/^[a-z]+\/[a-z0-9.\-]+$/);
    }
  });

  it('every model declares the lowest tier that can pick it', () => {
    for (const m of MODEL_CATALOG) {
      expect(['free', 'plus', 'pro']).toContain(m.minTier);
    }
  });

  it('exactly one model is flagged recommended', () => {
    const recommended = MODEL_CATALOG.filter((m) => m.recommended);
    expect(recommended).toHaveLength(1);
  });

  it('free tier gets exactly one available model (Haiku)', () => {
    const free = getModelsForTier('free');
    expect(free).toHaveLength(1);
    expect(free[0]?.id).toBe('anthropic/claude-haiku-4-5');
  });

  it('plus tier gets at least 3 models', () => {
    expect(getModelsForTier('plus').length).toBeGreaterThanOrEqual(3);
  });

  it('pro tier includes Opus', () => {
    const pro = getModelsForTier('pro');
    expect(pro.some((m) => m.id === 'anthropic/claude-opus-4-7')).toBe(true);
  });

  it('getModelById returns undefined for unknown id', () => {
    expect(getModelById('nope/nope')).toBeUndefined();
  });

  it('getTierDefault returns Haiku for free, Sonnet for plus/pro', () => {
    expect(getTierDefault('free')).toBe('anthropic/claude-haiku-4-5');
    expect(getTierDefault('plus')).toBe('anthropic/claude-sonnet-4-6');
    expect(getTierDefault('pro')).toBe('anthropic/claude-sonnet-4-6');
  });
});
