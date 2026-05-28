import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_DELETION_GRACE_DAYS, isWithinRestoreWindow } from '@/lib/account-lifecycle';

/**
 * The restore window is the load-bearing invariant behind account recovery:
 * sign-in auto-restores a soft-deleted account iff it's still inside this
 * window, and the purge cron hard-deletes iff it's outside. A drift between
 * the two would either resurrect tombstones or lock returning users out, so
 * we pin the boundary behaviour here.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed "now" so day-math is deterministic regardless of when the suite runs.
const NOW = new Date('2026-05-28T12:00:00.000Z');

describe('isWithinRestoreWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a live (never-deleted) account', () => {
    expect(isWithinRestoreWindow(null)).toBe(false);
    expect(isWithinRestoreWindow(undefined)).toBe(false);
  });

  it('returns true the instant after deletion', () => {
    expect(isWithinRestoreWindow(NOW)).toBe(true);
  });

  it('returns true just inside the grace window', () => {
    const justInside = new Date(NOW.getTime() - (ACCOUNT_DELETION_GRACE_DAYS * DAY_MS - 60_000));
    expect(isWithinRestoreWindow(justInside)).toBe(true);
  });

  it('returns false just past the grace window', () => {
    const justPast = new Date(NOW.getTime() - (ACCOUNT_DELETION_GRACE_DAYS * DAY_MS + 60_000));
    expect(isWithinRestoreWindow(justPast)).toBe(false);
  });

  it('returns false exactly at the boundary (strict inequality)', () => {
    const exactly = new Date(NOW.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
    expect(isWithinRestoreWindow(exactly)).toBe(false);
  });

  it('keeps the grace period at 30 days (purge cron depends on this)', () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });
});
