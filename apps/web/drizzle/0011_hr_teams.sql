-- Migration: 0011_hr_teams
-- Adds companies, company_members, company_invites tables
-- and jobs.company_id FK column (M5 HR Recruiter Completeness)

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(80) NOT NULL UNIQUE,
  "logo_url" text,
  "description" text,
  "website_url" text,
  "owner_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_owner_idx" ON "companies" ("owner_user_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL DEFAULT 'recruiter',
  "invited_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "invited_at" timestamptz,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "company_members_company_user_unique" UNIQUE ("company_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_members_company_idx" ON "company_members" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_members_user_idx" ON "company_members" ("user_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "email" varchar(320),
  "token" varchar(64) NOT NULL UNIQUE,
  "role" varchar(16),
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_invites_token_idx" ON "company_invites" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_invites_company_idx" ON "company_invites" ("company_id");

--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL;
