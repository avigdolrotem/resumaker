/**
 * Audit log helper.
 *
 * Wire into auth callbacks + mutation routes for compliance trail.
 * Fire-and-forget: never blocks the user's request on audit write.
 */

import { createHash } from 'crypto';
import { db, schema } from '@/db';

/**
 * Privacy-preserving IP storage: SHA-256 the IP so we can correlate
 * sessions/abuse without storing PII directly.
 */
function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export type AuditEventName =
  | 'sign_up'
  | 'sign_in'
  | 'sign_in_failed'
  | 'sign_out'
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
  | 'admin_action';

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
