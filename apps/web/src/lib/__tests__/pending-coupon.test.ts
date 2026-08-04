import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { savePendingCoupon, readPendingCoupon, clearPendingCoupon } from '../pending-coupon';

/**
 * A held promo code must survive the signup detour but not linger
 * forever — a code someone picked up months ago shouldn't silently
 * reappear on an unrelated purchase.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('pending coupon', () => {
  it('round-trips a saved code', () => {
    savePendingCoupon('LAUNCH25');
    expect(readPendingCoupon()).toBe('LAUNCH25');
  });

  it('trims whitespace and ignores an empty code', () => {
    savePendingCoupon('  SAVE10  ');
    expect(readPendingCoupon()).toBe('SAVE10');
    clearPendingCoupon();
    savePendingCoupon('   ');
    expect(readPendingCoupon()).toBeNull();
  });

  it('returns null once past the 30-day TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    savePendingCoupon('OLD');
    vi.setSystemTime(new Date('2026-01-29T00:00:00Z'));
    expect(readPendingCoupon()).toBe('OLD'); // 28 days — still live
    vi.setSystemTime(new Date('2026-02-05T00:00:00Z'));
    expect(readPendingCoupon()).toBeNull(); // 35 days — expired
  });

  it('clears the stored value once expired rather than re-reading it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    savePendingCoupon('OLD');
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    readPendingCoupon();
    expect(store.size).toBe(0);
  });

  it('clear() removes it', () => {
    savePendingCoupon('GONE');
    clearPendingCoupon();
    expect(readPendingCoupon()).toBeNull();
  });

  it('refuses a code longer than the API would ever accept', () => {
    // `?coupon=` is attacker-controlled and gets echoed into the
    // "we'll check your code" banner — an uncapped value overflowed
    // the layout horizontally.
    savePendingCoupon('A'.repeat(41));
    expect(readPendingCoupon()).toBeNull();
    savePendingCoupon('A'.repeat(40));
    expect(readPendingCoupon()).toBe('A'.repeat(40));
  });

  it('rejects an over-long value already sitting in storage', () => {
    store.set(
      'resumaker:pending-coupon',
      JSON.stringify({ code: 'A'.repeat(5000), savedAt: Date.now() }),
    );
    expect(readPendingCoupon()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('survives corrupt storage without throwing', () => {
    store.set('resumaker:pending-coupon', 'not json');
    expect(readPendingCoupon()).toBeNull();
    store.set('resumaker:pending-coupon', JSON.stringify({ nope: true }));
    expect(readPendingCoupon()).toBeNull();
  });
});
