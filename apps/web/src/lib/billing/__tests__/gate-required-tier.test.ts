import { describe, it, expect } from 'vitest';
import { canGenerate, canCreateResume, canCreateCoverLetter } from '../tier';

/**
 * A gate must never name a tier the user already pays for. The limits
 * previously hardcoded 'plus' as the answer for everyone, so a Plus
 * subscriber who hit their 20/day generation cap was shown "Upgrade to
 * Plus" — an upsell to their own plan, and no way forward.
 */

describe('gate requiredTier', () => {
  it('points a free user at Plus', () => {
    expect(canGenerate('free', 99).requiredTier).toBe('plus');
    expect(canCreateResume('free', 99).requiredTier).toBe('plus');
    expect(canCreateCoverLetter('free', 99).requiredTier).toBe('plus');
  });

  it('points a Plus user at Pro, not back at Plus', () => {
    const gen = canGenerate('plus', 20);
    expect(gen.allowed).toBe(false);
    expect(gen.requiredTier).toBe('pro');
    expect(gen.requiredTier).not.toBe('plus');

    expect(canCreateResume('plus', 10).requiredTier).toBe('pro');
    expect(canCreateCoverLetter('plus', 5).requiredTier).toBe('pro');
  });

  it('reports the usage that triggered the gate', () => {
    const gen = canGenerate('plus', 20);
    expect(gen.current).toBe(20);
    expect(gen.limit).toBe(20);
  });

  it('never blocks Pro on these three — the limits are unlimited', () => {
    expect(canGenerate('pro', 10_000).allowed).toBe(true);
    expect(canCreateResume('pro', 10_000).allowed).toBe(true);
    expect(canCreateCoverLetter('pro', 10_000).allowed).toBe(true);
  });

  it('still allows a Plus user below the cap', () => {
    expect(canGenerate('plus', 19).allowed).toBe(true);
    expect(canCreateResume('plus', 9).allowed).toBe(true);
  });
});
