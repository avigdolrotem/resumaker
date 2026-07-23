-- Job scraping: staleness/closure tracking, cross-source dedup, and a
-- resumable-crawl run log. See packages/job-engine and
-- apps/web/src/app/api/cron/scrape-jobs — jobs were previously
-- insert-once with no mechanism to detect a listing closing, and no
-- unique constraint on (source, external_id) despite the jobs table's
-- own doc comment promising one.
--
-- (This migration's generated diff also included profiles/resumes
-- statements that duplicate 0018_career_profile.sql, which already
-- shipped them for real — 0018's committed snapshot file just never
-- reflected that migration's actual SQL. Hand-trimmed out here so this
-- migration only contains what's actually new; 0018 itself is untouched.)
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cursor" jsonb,
	"stats" jsonb,
	"ok" boolean
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "status" varchar(16) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "miss_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "canonical_job_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "occupation_code" varchar(64);--> statement-breakpoint
ALTER TABLE "user_jobs" ADD COLUMN "fit_scored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_jobs" ADD COLUMN "recommended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_jobs" ADD COLUMN "recommend_score" real;--> statement-breakpoint
ALTER TABLE "user_jobs" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "scrape_runs_source_started_idx" ON "scrape_runs" USING btree ("source","started_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_canonical_job_id_jobs_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_external_id_unique" ON "jobs" USING btree ("source","external_id") WHERE "jobs"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_canonical_job_idx" ON "jobs" USING btree ("canonical_job_id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_canonical_not_self_check" CHECK ("jobs"."canonical_job_id" IS NULL OR "jobs"."canonical_job_id" != "jobs"."id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('open', 'closed', 'unknown'));
