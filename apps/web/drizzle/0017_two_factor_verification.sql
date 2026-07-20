-- two_factors was missing three columns better-auth's twoFactor plugin
-- requires (added in a better-auth release after this table was first
-- hand-written): verified, failedVerificationCount, lockedUntil.
-- Every call to POST /api/auth/two-factor/enable 500'd with
-- "The field verified does not exist in the twoFactor Drizzle schema"
-- until these were added. Field names/types/defaults match
-- better-auth's plugins/two-factor/schema.ts exactly.

ALTER TABLE "two_factors" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factors" ADD COLUMN "failed_verification_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factors" ADD COLUMN "locked_until" timestamp with time zone;
