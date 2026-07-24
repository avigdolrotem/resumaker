-- jobs_url_norm_idx has been a plain (non-unique) index since it was
-- first created in 0007_job_hunt_beta.sql. schema.ts was later changed
-- to declare unique('jobs_url_norm_unique').on(t.urlNormalized) — see
-- the comment on that field ("Previously a plain index meant every
-- duplicate threw...") — and drizzle-kit's tracked snapshot has
-- believed that constraint exists ever since, but no migration ever
-- actually applied it: `drizzle-kit generate` reports "no schema
-- changes" today, the same silent-drift failure mode already found and
-- fixed once this session for user_jobs (see
-- 0021_user_jobs_unique_fix.sql). Found by auditing for the same
-- pattern elsewhere after that one turned out to be real, not by
-- another live failure this time — nothing currently upserts on
-- urlNormalized (scrape-jobs and scrape-taasuka both target
-- (source, external_id), which does have a real constraint;
-- /api/jobs/import does its own SELECT-then-INSERT check instead of
-- relying on ON CONFLICT). Fixing before something starts relying on
-- it, same as schema.ts already promises it can.
--
-- Dedupe first in case any environment accumulated real duplicates
-- while this went unenforced: keep the most recently scraped row per
-- URL, delete the rest.
DELETE FROM jobs a
USING jobs b
WHERE a.url_normalized = b.url_normalized
  AND (a.scraped_at, a.id) < (b.scraped_at, b.id);
--> statement-breakpoint

DROP INDEX IF EXISTS jobs_url_norm_idx;
--> statement-breakpoint
ALTER TABLE jobs ADD CONSTRAINT jobs_url_norm_unique UNIQUE (url_normalized);
