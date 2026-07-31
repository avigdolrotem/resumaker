import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from '../db-errors';

/**
 * Drizzle wraps driver errors: the thrown DrizzleQueryError has no
 * `.code` and a "Failed query: …" message, while the PostgresError with
 * SQLSTATE 23505 hangs off `.cause`. Checking only the top level made
 * every conflict-handling branch in the app unreachable — observed live
 * as a 500 (instead of 409) from POST /api/trusted-sharer/request when
 * its partial unique index fired.
 */
describe('isUniqueViolation', () => {
  it('detects a bare driver error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('detects a Drizzle-wrapped driver error via cause', () => {
    const wrapped = new Error('Failed query: insert into "trusted_sharer_requests" ...');
    (wrapped as Error & { cause?: unknown }).cause = Object.assign(
      new Error('duplicate key value violates unique constraint "x_one_pending_per_user"'),
      { code: '23505' },
    );
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('detects it by message anywhere in the chain', () => {
    const outer = new Error('wrapper');
    (outer as Error & { cause?: unknown }).cause = new Error(
      'duplicate key value violates unique constraint "foo"',
    );
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it('is false for unrelated errors', () => {
    expect(isUniqueViolation(new Error('connection reset'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false); // FK violation
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('terminates on a self-referential cause chain', () => {
    const loop: { code?: string; cause?: unknown } = { code: 'X' };
    loop.cause = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });
});
