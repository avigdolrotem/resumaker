-- V2: saved job-search alerts.
--
-- Each row is one query the user wants the daily digest cron to
-- monitor. `query` is opaque JSONB matching /api/jobs query-param
-- shape (q, company, source, remote). `lastNotifiedAt` is bumped by
-- the cron after each digest so we only email newly-scraped jobs.

CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"              varchar(100) NOT NULL,
  "query"             jsonb NOT NULL,
  "alert_frequency"   varchar(16) NOT NULL DEFAULT 'daily',
  "last_notified_at"  timestamptz,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "saved_searches_user_idx" ON "saved_searches"("user_id");
