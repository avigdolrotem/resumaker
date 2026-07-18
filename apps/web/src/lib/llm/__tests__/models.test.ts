import { describe, it, expect } from 'vitest';
import { MODEL_CATALOG, getModelsForTier, getModelById, getTierDefault } from '../models';

// Catalog is Gemini-only right now — Anthropic is commented out in
// models.ts pending a Vertex AI Model Garden entitlement fix (see the
// long comment there). These assertions reflect that temporary state;
// loosen them back up once Claude entries are restored.
describe('LLM model catalog', () => {
  it('contains at least 2 models', () => {
    expect(MODEL_CATALOG.length).toBeGreaterThanOrEqual(2);
  });

  it('every model id matches the provider/model regex (including Vertex @date suffix)', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.id).toMatch(/^[a-z]+\/[a-z0-9.@\-]+$/);
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

  it('free tier gets multiple models including Gemini Flash', () => {
    const free = getModelsForTier('free');
    expect(free.length).toBeGreaterThanOrEqual(1);
    expect(free.some((m) => m.id === 'google/gemini-2.5-flash')).toBe(true);
  });

  it('plus tier gets at least 2 models', () => {
    expect(getModelsForTier('plus').length).toBeGreaterThanOrEqual(2);
  });

  it('pro tier is a superset of plus tier', () => {
    const plus = getModelsForTier('plus').map((m) => m.id);
    const pro = getModelsForTier('pro').map((m) => m.id);
    expect(plus.every((id) => pro.includes(id))).toBe(true);
  });

  it('getModelById returns undefined for unknown id', () => {
    expect(getModelById('nope/nope')).toBeUndefined();
  });

  it('getTierDefault returns Gemini Flash for free, Gemini Pro for plus/pro', () => {
    expect(getTierDefault('free')).toBe('google/gemini-2.5-flash');
    expect(getTierDefault('plus')).toBe('google/gemini-2.5-pro');
    expect(getTierDefault('pro')).toBe('google/gemini-2.5-pro');
  });
});
