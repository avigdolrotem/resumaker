-- user_jobs_user_job_idx has been a plain (non-unique) index this whole
-- time, despite schema.ts declaring unique(t.userId, t.jobId) since
-- user_jobs was first added — drizzle-kit generate produces "no schema
-- changes" for this today because its tracked snapshot history already
-- (incorrectly) believes the unique constraint exists; the live database
-- never actually got it. Found by generateRecommendationsForUser's own
-- onConflictDoUpdate failing with "no unique or exclusion constraint
-- matching the ON CONFLICT specification" the first time anything tried
-- to exercise it — a bug pre-dating this migration, not introduced by it.
--
-- Because uniqueness was never enforced, a concurrent favorite-toggle or
-- fit-score write could have created more than one row for the same
-- (user_id, job_id) pair at any point up to now. Reconcile before adding
-- the real constraint: keep the most recently updated row per pair
-- (ties broken by id), delete the rest.
DELETE FROM user_jobs a
USING user_jobs b
WHERE a.user_id = b.user_id
  AND a.job_id = b.job_id
  AND (a.updated_at, a.id) < (b.updated_at, b.id);
--> statement-breakpoint

DROP INDEX IF EXISTS user_jobs_user_job_idx;
--> statement-breakpoint
ALTER TABLE user_jobs ADD CONSTRAINT user_jobs_user_job_unique UNIQUE (user_id, job_id);
