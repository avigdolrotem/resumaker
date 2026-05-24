/**
 * Audit log helper.
 *
 * Wire into auth callbacks + mutation routes for compliance trail.
 * Fire-and-forget: never blocks the user's request on audit write.
 */

import { createHmac } from 'crypto';
import { db, schema } from '@/db';

/**
 * Privacy-preserving IP storage: HMAC-SHA256 the IP with a per-deployment
 * secret. Plain SHA-256 of an IPv4 address has only ~4B preimages — trivially
 * reversible with a rainbow table. HMAC binds the hash to our secret so a
 * DB dump on its own can't be reversed.
 *
 * Falls back to BETTER_AUTH_SECRET so the function still works in dev where
 * IP_HASH_SALT isn't separately set. Production should set a distinct
 * IP_HASH_SALT and rotate it yearly (audit_log rows pre-rotation become
 * un-correlatable to post-rotation rows — that's by design).
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const secret = process.env.IP_HASH_SALT ?? process.env.BETTER_AUTH_SECRET ?? '';
  if (!secret) return null; // never store an unsalted hash
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

export type AuditEventName =
  | 'sign_up'
  | 'sign_in'
  | 'sign_in_failed'
  | 'sign_out'
  | 'email_verification_send_failed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_changed'
  | 'oauth_linked'
  | 'oauth_unlinked'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'profile_updated'
  | 'profile_imported'
  | 'resume_created'
  | 'resume_updated'
  | 'resume_deleted'
  | 'resume_downloaded_pdf'
  | 'resume_generated'
  | 'resume_generation_blocked'
  | 'resume_scored'
  | 'rate_limit_hit'
  | 'account_deleted'
  | 'data_exported'
  | 'admin_action'
  | 'billing_checkout_started'
  | 'billing_subscription_created'
  | 'billing_subscription_updated'
  | 'billing_subscription_canceled'
  | 'billing_payment_failed'
  | 'billing_portal_opened';

interface AuditInput {
  userId?: string | null | undefined;
  event: AuditEventName;
  metadata?: Record<string, unknown> | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

/**
 * Insert an audit event. Logs but never throws — auditing must
 * never break user-facing flows.
 */
export function auditEvent(input: AuditInput): void {
  void db
    .insert(schema.auditLog)
    .values({
      userId: input.userId ?? null,
      event: input.event,
      metadata: input.metadata ?? null,
      ipHash: hashIp(input.ipAddress),
      userAgent: input.userAgent ?? null,
    })
    .catch((err) => {
      // Don't propagate — but DO log so we know about audit failures
      console.error('[audit] failed to record event', input.event, err);
    });
}
