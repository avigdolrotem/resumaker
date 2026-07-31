/**
 * Postgres error helpers.
 *
 * String-matching `err.message.includes('duplicate key')` is fragile —
 * a driver upgrade or different locale breaks idempotency. Use SQLSTATE
 * codes which are stable per the SQL standard.
 *
 * postgres-js attaches the SQLSTATE as `err.code`. Drizzle re-throws
 * with the original error preserved.
 */

interface PgError {
  code?: string;
  message?: string;
  cause?: unknown;
}

/** How far to walk the `cause` chain before giving up. */
const MAX_CAUSE_DEPTH = 5;

/**
 * SQLSTATE 23505 — unique constraint violation.
 *
 * Walks the `cause` chain. Drizzle does NOT re-throw the driver error
 * directly (despite what this file used to claim): it wraps it in a
 * DrizzleQueryError whose own `.code` is undefined and whose message is
 * "Failed query: insert into …". The real PostgresError — the one
 * carrying `code: '23505'` — sits at `err.cause`. Checking only the top
 * level silently returned false for every real conflict, which meant
 * every caller's conflict-handling branch was dead code: duplicate
 * applications 500'd instead of returning the existing row, the resume
 * slug retry never retried, and both billing webhooks logged a spurious
 * error on their idempotent-replay path.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    const e = current as PgError;
    if (e.code === '23505') return true;
    if (/duplicate key value violates unique constraint/i.test(e.message ?? '')) return true;
    current = e.cause;
  }
  return false;
}
