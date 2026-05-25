-- Task 2.1: Add user-selected LLM preference column.
--
-- NULL = use tier default (resolved by resolveModelForUser).
-- Only Plus/Pro tiers can set a non-default value; Free is locked
-- to Haiku. Written by hand to avoid drizzle snapshot drift
-- (migrations 0006–0015 were hand-authored and never went through
-- drizzle-kit generate, so the meta snapshots only reflect 0005).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "llm_model" text;
