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
}

/** SQLSTATE 23505 — unique constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err) return false;
  const code = (err as PgError).code;
  if (code === '23505') return true;
  // Belt-and-suspenders for older postgres-js or wrapped errors
  const msg = (err as PgError).message ?? '';
  return /duplicate key value violates unique constraint/i.test(msg);
}

/** SQLSTATE 23503 — foreign key violation. */
export function isForeignKeyViolation(err: unknown): boolean {
  if (!err) return false;
  return (err as PgError).code === '23503';
}

/** SQLSTATE 23502 — not-null violation. */
export function isNotNullViolation(err: unknown): boolean {
  if (!err) return false;
  return (err as PgError).code === '23502';
}

/** SQLSTATE 40001/40P01 — serialization / deadlock — caller should retry. */
export function isRetryableTransactionError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as PgError).code;
  return code === '40001' || code === '40P01';
}
