ALTER TABLE "jobs" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING gin ("search_vector");--> statement-breakpoint

-- Maintained by trigger, not application code, so search_vector stays
-- correct no matter which code path writes a row (the scrape-jobs cron,
-- scrape-taasuka, a manual import, HR posting a job directly, ...) —
-- drizzle-kit has no concept of trigger DDL, this is hand-written.
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS jobs_search_vector_trigger ON "jobs";
--> statement-breakpoint
CREATE TRIGGER jobs_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();
--> statement-breakpoint

-- Backfill rows that existed before the trigger did.
UPDATE "jobs" SET search_vector = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''));
