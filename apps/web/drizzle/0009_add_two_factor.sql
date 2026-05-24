-- M2: Two-Factor Authentication (TOTP) support.
--
-- Adds the two_factors table required by Better Auth's twoFactor plugin
-- and the twoFactorEnabled flag on users.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "two_factors" (
  "id"           text PRIMARY KEY,
  "user_id"      text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret"       text NOT NULL,
  "backup_codes" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "two_factors_user_idx" ON "two_factors"("user_id");
