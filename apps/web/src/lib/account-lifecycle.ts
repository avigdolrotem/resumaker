/**
 * Account soft-delete lifecycle.
 *
 * When a user deletes their account we set `users.deletedAt` (soft delete) and
 * the daily purge cron hard-deletes the row once it's older than the grace
 * window. During that window the account is *restorable*: if the owner signs
 * back in with the correct password we clear `deletedAt` instead of leaving
 * them locked out.
 *
 * This is the single source of truth for the grace period — both the purge
 * cron (api/cron/purge) and the auth restore logic (lib/auth) import it so the
 * "still restorable?" and "safe to hard-delete?" decisions can never drift.
 */

/** Days a soft-deleted account is retained before the purge cron hard-deletes it. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

const GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * True if a soft-deleted account is still inside its restore window (i.e. the
 * purge cron has not yet hard-deleted it and it's safe to reactivate).
 *
 * Returns false for a live account (`deletedAt` null) and for one whose grace
 * window has elapsed.
 */
export function isWithinRestoreWindow(deletedAt: Date | null | undefined): deletedAt is Date {
  if (!deletedAt) return false;
  return deletedAt.getTime() > Date.now() - GRACE_MS;
}
