-- M8: Referral program — referral_codes + referrals

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code"         varchar(20) NOT NULL UNIQUE,
  "owner_id"     text        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "usage_count"  integer     NOT NULL DEFAULT 0,
  "max_uses"     integer,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_codes_code_idx"  ON "referral_codes" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_codes_owner_idx" ON "referral_codes" ("owner_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referrer_id"       text        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_id"       text        NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "status"            varchar(16) NOT NULL DEFAULT 'pending',
  "qualified_at"      timestamptz,
  "reward_claimed_at" timestamptz,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referred_idx" ON "referrals" ("referred_id");
