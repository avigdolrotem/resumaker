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
import { and, inArray, isNotNull, lt } from 'drizzle-orm';
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

// Stripe/LemonSqueezy webhook event rows store the full raw provider
// payload (standard shape includes customer email/name/billing
// address) purely for idempotency — the actual source of truth is the
// subscriptions table and the provider's own dashboard. They have no
// userId column so they can't be swept by the user-purge cascade below,
// and previously had no age-based cleanup at all, letting that PII
// outlive the 30-day account-purge promise indefinitely. 90 days is
// well past any realistic idempotency-replay or dispute window.
const WEBHOOK_EVENT_RETENTION_DAYS = 90;

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const grace = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const verifyTtl = new Date(Date.now() - VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const webhookEventCutoff = new Date(
    Date.now() - WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const results: Record<string, number> = {};

  // 0. Support tickets reference userId with ON DELETE SET NULL, not
  //    CASCADE, so the user-delete below would leave the ticket row's
  //    raw email + body behind untouched — contradicting the "full
  //    purge within 30 days" promise in the privacy policy. Delete
  //    them explicitly, BEFORE the user rows are gone: once the FK
  //    fires SET NULL we lose the ability to find them by userId at
  //    all. (The FK itself is left as SET NULL rather than migrated to
  //    CASCADE — this cron already needs the purge-eligible id list for
  //    the audit-log unlink step below, so reusing it here is simpler
  //    than a schema migration for the same outcome.)
  const purgeEligibleUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(isNotNull(schema.users.deletedAt), lt(schema.users.deletedAt, grace)));
  const purgeEligibleIds = purgeEligibleUsers.map((u) => u.id);

  if (purgeEligibleIds.length > 0) {
    const deletedTickets = await db
      .delete(schema.supportTickets)
      .where(inArray(schema.supportTickets.userId, purgeEligibleIds))
      .returning({ id: schema.supportTickets.id });
    results.supportTicketsPurged = deletedTickets.length;
  } else {
    results.supportTicketsPurged = 0;
  }

  // 1. Hard-delete users whose soft-delete grace period expired.
  //    Drizzle cascade handles resumes, generations, sessions, accounts,
  //    ats_scores, applications, user_jobs, saved_searches,
  //    notifications, subscriptions, referrals, push_subscriptions, and
  //    two_factors via FK ON DELETE CASCADE.
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
  //    Was a raw `db.execute(sql\`...\`)` call with a JS Date embedded
  //    directly in the template — that path doesn't get the same
  //    driver-level Date serialization the query builder gets, so it
  //    threw on every single invocation ("received an instance of
  //    Date", expected string/Buffer/ArrayBuffer), meaning this step
  //    (and everything after it) never actually ran in production.
  //    Query builder — matching every other delete in this file — just
  //    works, since Drizzle serializes the Date correctly there.
  const auditCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const deletedAudits = await db
    .delete(schema.auditLog)
    .where(lt(schema.auditLog.createdAt, auditCutoff))
    .returning({ id: schema.auditLog.id });
  results.auditEventsTrimmed = deletedAudits.length;

  // 5. Trim old payment-webhook event rows — see WEBHOOK_EVENT_RETENTION_DAYS.
  const deletedStripeEvents = await db
    .delete(schema.stripeWebhookEvents)
    .where(lt(schema.stripeWebhookEvents.processedAt, webhookEventCutoff))
    .returning({ id: schema.stripeWebhookEvents.id });
  results.stripeWebhookEventsTrimmed = deletedStripeEvents.length;

  const deletedLsEvents = await db
    .delete(schema.lsWebhookEvents)
    .where(lt(schema.lsWebhookEvents.processedAt, webhookEventCutoff))
    .returning({ id: schema.lsWebhookEvents.id });
  results.lsWebhookEventsTrimmed = deletedLsEvents.length;

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
