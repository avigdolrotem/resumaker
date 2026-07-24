-- Same drift class as 0021 (user_jobs) and 0022 (jobs.url_normalized),
-- found by auditing every other table-level unique() in schema.ts after
-- those two turned out to be real: both of these have been missing
-- their declared constraint since the table was created, and neither
-- even has a same-named substitute index masking it.
--
-- resume_versions_resume_version_unique: 0003_greedy_juggernaut.sql only
-- ever created a plain index on (resume_id, version_number). schema.ts's
-- own comment on this field explains why that's not enough — the
-- version-bump logic in /api/resumes/[id] PATCH does
-- SELECT MAX(version_number)+1 → INSERT, so two concurrent PATCHes can
-- currently pick the same version_number with nothing to stop them.
--
-- applications_user_job_unique: 0007_job_hunt_beta.sql created the
-- applications table with no index or constraint on (user_id, job_id)
-- at all. schema.ts's comment: without this, double-clicking "Apply"
-- can currently create two pipeline rows for the same job.
--
-- Dedupe first in case either gap was already hit in some environment:
-- keep the most recent row per key, delete the rest.
DELETE FROM resume_versions a
USING resume_versions b
WHERE a.resume_id = b.resume_id
  AND a.version_number = b.version_number
  AND (a.created_at, a.id) < (b.created_at, b.id);
--> statement-breakpoint

DELETE FROM applications a
USING applications b
WHERE a.user_id = b.user_id
  AND a.job_id = b.job_id
  AND (a.updated_at, a.id) < (b.updated_at, b.id);
--> statement-breakpoint

DROP INDEX IF EXISTS resume_versions_resume_idx;
--> statement-breakpoint
ALTER TABLE resume_versions ADD CONSTRAINT resume_versions_resume_version_unique UNIQUE (resume_id, version_number);
--> statement-breakpoint
ALTER TABLE applications ADD CONSTRAINT applications_user_job_unique UNIQUE (user_id, job_id);
