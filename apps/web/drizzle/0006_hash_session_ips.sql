-- Strip plaintext IPs from existing sessions.
--
-- New sessions will store an HMAC hash (see databaseHooks.session.create.before
-- in src/lib/auth.ts), but existing rows hold raw IPv4/IPv6. We can't recover
-- the original IP to hash it after the fact (we never wanted the plaintext to
-- exist on disk), so the safest move is to NULL the column for everything that
-- predates this migration. Loss is acceptable: the column is informational, and
-- the audit_log table already keeps a properly-hashed copy of every sign-in IP.
--
-- After this runs, anything in `sessions.ip_address` is guaranteed to be either
-- NULL or an HMAC-SHA256-hex-prefix (32 chars), never a raw address.

UPDATE "sessions" SET "ip_address" = NULL WHERE "ip_address" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Redact targetEmail from historical admin_action audit rows.
--
-- We previously stored the target user's email in audit_log.metadata so admins
-- could read "rotem suspended bob@example.com" in the audit timeline. The
-- problem: when bob deletes his account 6 months later, his email persists in
-- our retention indefinitely. GDPR Art. 17 (right to erasure) doesn't allow
-- that. The route handlers now write `targetUserId` only; this migration
-- removes any pre-existing `targetEmail` from past rows. The id is still
-- there, so admins can join against the live users table if the target still
-- exists; if not, the audit row just says "user $UUID" which is correct.
-- ─────────────────────────────────────────────────────────────────────

UPDATE "audit_log"
SET    "metadata" = "metadata" - 'targetEmail'
WHERE  "event" = 'admin_action'
  AND  "metadata" ? 'targetEmail';
