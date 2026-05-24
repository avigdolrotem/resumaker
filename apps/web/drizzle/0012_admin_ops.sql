-- M6 Admin Operations migration
-- Adds: coupons, coupon_redemptions, broadcast_emails, impersonation_sessions, maintenance_mode

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(40) UNIQUE NOT NULL,
  "discount_percent" integer NOT NULL,
  "expires_at" timestamptz,
  "usage_limit" integer,
  "usage_count" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "coupons_discount_check" CHECK ("discount_percent" BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons" ("code");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redeemed_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "coupon_redemptions_coupon_user_unique" UNIQUE ("coupon_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_idx" ON "coupon_redemptions" ("coupon_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_idx" ON "coupon_redemptions" ("user_id");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "broadcast_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "locale" varchar(8) NOT NULL DEFAULT 'he',
  "sent_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "sent_at" timestamptz,
  "recipient_count" integer,
  "status" varchar(16) NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "broadcast_emails_status_idx" ON "broadcast_emails" ("status");
CREATE INDEX IF NOT EXISTS "broadcast_emails_created_at_idx" ON "broadcast_emails" ("created_at" DESC);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz,
  "reason" text
);

CREATE INDEX IF NOT EXISTS "impersonation_admin_idx" ON "impersonation_sessions" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "impersonation_target_idx" ON "impersonation_sessions" ("target_user_id");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "maintenance_mode" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "message" text,
  "scheduled_start" timestamptz,
  "scheduled_end" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "maintenance_mode_singleton" CHECK ("id" = 1)
);

-- Seed the singleton row
INSERT INTO "maintenance_mode" ("id", "enabled") VALUES (1, false) ON CONFLICT ("id") DO NOTHING;
