-- L5: job-hunt beta — schema additions
--
-- Adds the jobs / user_jobs / applications tables that back the job-hunt
-- surface, plus the `feature_flags` JSONB column on `users` that gates
-- access to the new routes (only users with `featureFlags.jobHuntBeta=true`
-- can see /jobs and /applications).
--
-- All new tables are independent of resumes/cover_letters — those FKs
-- use ON DELETE SET NULL so applications survive a resume delete with
-- the resume reference simply nulled out.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "feature_flags" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── jobs (shared across users) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "jobs" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_id"     text,
  "source"          varchar(32) NOT NULL,
  "company"         varchar(200) NOT NULL,
  "company_slug"    varchar(200),
  "title"           varchar(300) NOT NULL,
  "location"        varchar(200),
  "description"     text NOT NULL,
  "url"             text NOT NULL,
  "url_normalized"  text NOT NULL,
  "remote"          boolean NOT NULL DEFAULT false,
  "seniority"       varchar(50),
  "hr_user_id"      text REFERENCES "users"("id") ON DELETE SET NULL,
  "posted_at"       timestamptz,
  "scraped_at"      timestamptz NOT NULL DEFAULT now(),
  "raw_data"        jsonb
);

CREATE INDEX IF NOT EXISTS "jobs_url_norm_idx"      ON "jobs"("url_normalized");
CREATE INDEX IF NOT EXISTS "jobs_source_company_idx" ON "jobs"("source", "company_slug");
CREATE INDEX IF NOT EXISTS "jobs_scraped_at_idx"    ON "jobs"("scraped_at" DESC);
CREATE INDEX IF NOT EXISTS "jobs_hr_user_idx"       ON "jobs"("hr_user_id");

-- ─── user_jobs (per-user state: favorite, fit-score) ────────────────
CREATE TABLE IF NOT EXISTS "user_jobs" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        text    NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "job_id"         uuid    NOT NULL REFERENCES "jobs"("id")  ON DELETE CASCADE,
  "is_favorite"    boolean NOT NULL DEFAULT false,
  "fit_score"      integer,
  "fit_rationale"  text,
  "fit_strengths"  jsonb,
  "fit_gaps"       jsonb,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_jobs_user_job_idx" ON "user_jobs"("user_id", "job_id");

-- ─── applications (tracker) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "applications" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           text    NOT NULL REFERENCES "users"("id")          ON DELETE CASCADE,
  "job_id"            uuid    NOT NULL REFERENCES "jobs"("id")           ON DELETE CASCADE,
  "resume_id"         uuid    REFERENCES "resumes"("id")                 ON DELETE SET NULL,
  "cover_letter_id"   uuid    REFERENCES "cover_letters"("id")           ON DELETE SET NULL,
  "status"            varchar(32) NOT NULL DEFAULT 'interested',
  "contact_name"      varchar(200),
  "contact_email"     varchar(320),
  "notes"             text,
  "next_action_at"    timestamptz,
  "applied_at"        timestamptz,
  "notify_recruiter"  boolean NOT NULL DEFAULT false,
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "applications_user_updated_idx" ON "applications"("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "applications_job_idx"          ON "applications"("job_id");
CREATE INDEX IF NOT EXISTS "applications_status_idx"       ON "applications"("status");
