/**
 * GET /api/cron/purge — daily compliance purge
 *
 * Hard-deletes users (and cascading resumes/generations) whose
 * deletedAt is older than 30 days.
 *
 * Also cleans up expired verification tokens (>7d old).
 *
 * Auth: requires the CRON_SECRET header (set on the scheduler side).
 * Triggered by a GKE CronJob hitting this URL with the secret header.
 *
 * Idempotent — safe to retry.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { verifyCronSecret } from '@/lib/cron-auth';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/lib/account-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Grace window is shared with the sign-in restore logic (lib/auth) so a
// soft-deleted account is restorable for exactly as long as the purge spares it.
const DELETION_GRACE_DAYS = ACCOUNT_DELETION_GRACE_DAYS;
const VERIFICATION_TTL_DAYS = 7;

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const grace = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const verifyTtl = new Date(Date.now() - VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const results: Record<string, number> = {};

  // 1. Hard-delete users whose soft-delete grace period expired.
  //    Drizzle cascade handles resumes, generations, sessions, accounts,
  //    ats_scores, passkeys via FK ON DELETE CASCADE.
  //    Audit log is intentionally NOT cascaded (userId nullable, no FK).
  const deletedUsers = await db
    .delete(schema.users)
    .where(and(isNotNull(schema.users.deletedAt), lt(schema.users.deletedAt, grace)))
    .returning({ id: schema.users.id });
  results.usersHardDeleted = deletedUsers.length;

  // 1a. GDPR Art. 17 unlinkability: nullify audit_log.user_id for hard-deleted
  //     users so the data subject is no longer identifiable in log records.
  //     The log rows themselves are retained for legitimate-interest purposes.
  if (deletedUsers.length > 0) {
    const purgedUserIds = deletedUsers.map((u) => u.id);
    await db
      .update(schema.auditLog)
      .set({ userId: null })
      .where(
        and(isNotNull(schema.auditLog.userId), inArray(schema.auditLog.userId, purgedUserIds)),
      );
  }

  // 2. Clean up expired verification tokens (Better Auth doesn't TTL these)
  const deletedVerifications = await db
    .delete(schema.verifications)
    .where(lt(schema.verifications.expiresAt, verifyTtl))
    .returning({ id: schema.verifications.id });
  results.verificationsDeleted = deletedVerifications.length;

  // 3. Clean up expired sessions
  const now = new Date();
  const deletedSessions = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, now))
    .returning({ id: schema.sessions.id });
  results.sessionsExpired = deletedSessions.length;

  // 4. (Optional) Trim audit_log older than 1 year
  const auditCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const deletedAudits = await db.execute(
    sql`DELETE FROM ${schema.auditLog} WHERE ${schema.auditLog.createdAt} < ${auditCutoff} RETURNING id`,
  );
  results.auditEventsTrimmed =
    typeof deletedAudits === 'object' && 'rows' in deletedAudits
      ? (deletedAudits as { rows: unknown[] }).rows.length
      : 0;

  // Audit the purge itself (admin_action so it's distinguishable)
  auditEvent({
    event: 'admin_action',
    metadata: { kind: 'cron_purge', ...results },
  });

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
