/**
 * Pure-function tests for the tier limits + comparators.
 * These never touch the DB so they're safe to run in any environment.
 */

import { describe, it, expect } from 'vitest';
import { TIER_LIMITS, TIER_ORDER, DEFAULT_TIER, tierAtLeast } from './limits';

describe('TIER_LIMITS', () => {
  it('exposes a limit object for every tier in TIER_ORDER', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_LIMITS[tier]).toBeDefined();
      expect(TIER_LIMITS[tier].displayName.he).toBeTruthy();
      expect(TIER_LIMITS[tier].displayName.en).toBeTruthy();
    }
  });

  it('uses -1 to mean unlimited across all numeric fields on top tier', () => {
    const pro = TIER_LIMITS.pro;
    expect(pro.maxResumes).toBe(-1);
    expect(pro.generationsPerDay).toBe(-1);
    expect(pro.coverLettersPerMonth).toBe(-1);
    expect(pro.versionHistoryDays).toBe(-1);
  });

  it('free tier has strictly stricter limits than plus', () => {
    expect(TIER_LIMITS.free.maxResumes).toBeLessThan(TIER_LIMITS.plus.maxResumes);
    expect(TIER_LIMITS.free.generationsPerDay).toBeLessThan(TIER_LIMITS.plus.generationsPerDay);
    expect(TIER_LIMITS.free.totalTemplates).toBeLessThan(TIER_LIMITS.plus.totalTemplates);
  });

  it('plus tier sits between free and pro', () => {
    expect(TIER_LIMITS.plus.maxResumes).toBeGreaterThan(TIER_LIMITS.free.maxResumes);
    expect(TIER_LIMITS.plus.maxResumes).toBeLessThan(
      // -1 means unlimited which sorts as "infinity"
      TIER_LIMITS.pro.maxResumes === -1 ? Number.POSITIVE_INFINITY : TIER_LIMITS.pro.maxResumes,
    );
  });

  it('default tier is free', () => {
    expect(DEFAULT_TIER).toBe('free');
  });

  it('prices are positive numbers (or -1 for free)', () => {
    expect(TIER_LIMITS.free.priceMonthly).toBe(-1);
    expect(TIER_LIMITS.plus.priceMonthly).toBeGreaterThan(0);
    expect(TIER_LIMITS.pro.priceMonthly).toBeGreaterThan(TIER_LIMITS.plus.priceMonthly);
    expect(TIER_LIMITS.plus.priceYearly).toBeGreaterThan(0);
    expect(TIER_LIMITS.plus.priceQuarterly).toBeGreaterThan(0);
  });

  it('yearly price gives ~16-20% discount vs monthly', () => {
    for (const tier of ['plus', 'pro'] as const) {
      const monthly = TIER_LIMITS[tier].priceMonthly * 12;
      const yearly = TIER_LIMITS[tier].priceYearly;
      const discount = (monthly - yearly) / monthly;
      expect(discount).toBeGreaterThan(0.1);
      expect(discount).toBeLessThan(0.25);
    }
  });
});

describe('tierAtLeast', () => {
  it('compares correctly', () => {
    expect(tierAtLeast('free', 'free')).toBe(true);
    expect(tierAtLeast('plus', 'free')).toBe(true);
    expect(tierAtLeast('pro', 'plus')).toBe(true);
    expect(tierAtLeast('free', 'plus')).toBe(false);
    expect(tierAtLeast('plus', 'pro')).toBe(false);
  });
});
