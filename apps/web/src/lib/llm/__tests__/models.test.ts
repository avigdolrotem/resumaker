import { describe, it, expect } from 'vitest';
import { MODEL_CATALOG, getModelById, getTierDefault } from '../models';

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

  it('Gemini Flash is catalogued and free-tier accessible', () => {
    const flash = MODEL_CATALOG.find((m) => m.id === 'google/gemini-2.5-flash');
    expect(flash).toBeDefined();
    expect(flash?.minTier).toBe('free');
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
