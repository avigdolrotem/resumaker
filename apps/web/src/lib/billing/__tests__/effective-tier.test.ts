import { describe, it, expect } from 'vitest';
import { effectiveTier } from '../tier';

describe('effectiveTier', () => {
  it('admin role overrides any tier to pro', () => {
    expect(effectiveTier({ role: 'admin', tier: 'free' })).toBe('pro');
    expect(effectiveTier({ role: 'admin', tier: 'plus' })).toBe('pro');
    expect(effectiveTier({ role: 'admin', tier: 'pro' })).toBe('pro');
    expect(effectiveTier({ role: 'admin', tier: null })).toBe('pro');
  });

  it('non-admin returns their tier verbatim', () => {
    expect(effectiveTier({ role: 'user', tier: 'free' })).toBe('free');
    expect(effectiveTier({ role: 'user', tier: 'plus' })).toBe('plus');
    expect(effectiveTier({ role: 'user', tier: 'pro' })).toBe('pro');
  });

  it('missing tier defaults to free for non-admins', () => {
    expect(effectiveTier({ role: 'user', tier: null })).toBe('free');
    expect(effectiveTier({ role: null })).toBe('free');
    expect(effectiveTier({})).toBe('free');
  });

  it('does not write to a billing-state field — caller is responsible', () => {
    // Just documenting intent: this helper is pure. Admin getting "pro"
    // does NOT create a subscription row. Billing tables stay untouched.
    const u = { role: 'admin' as const, tier: 'free' as const };
    effectiveTier(u);
    expect(u.tier).toBe('free');
  });
});
