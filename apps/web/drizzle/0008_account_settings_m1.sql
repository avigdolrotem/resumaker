-- M1: Account & Settings — user preference columns + email-change flow.
--
-- Additive only — every existing user row gets safe defaults so the
-- /settings page can read them without a backfill pass.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "theme" varchar(8) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN IF NOT EXISTS "date_format" varchar(16) NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS "marketing_opt_in" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "avatar" text;

CREATE TABLE IF NOT EXISTS "email_change_requests" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     text          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "new_email"   varchar(320)  NOT NULL,
  "token"       varchar(64)   NOT NULL UNIQUE,
  "expires_at"  timestamptz   NOT NULL,
  "created_at"  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_change_token_idx" ON "email_change_requests"("token");
CREATE INDEX IF NOT EXISTS "email_change_user_idx"  ON "email_change_requests"("user_id");

-- Better Auth twoFactor plugin storage
CREATE TABLE IF NOT EXISTS "two_factors" (
  "id"            text PRIMARY KEY,
  "user_id"       text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
  "secret"        text NOT NULL,
  "backup_codes"  text NOT NULL
);
CREATE INDEX IF NOT EXISTS "two_factors_user_idx" ON "two_factors"("user_id");
