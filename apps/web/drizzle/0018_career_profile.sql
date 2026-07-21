-- Career profile: one canonical contact/summary/experience/education/
-- skills/etc. blob per user, replacing the old per-resume "basic mode"
-- profile form. Every generated resume now tailors this shared source
-- data to a specific job description instead of owning its own
-- independent copy — see profiles.content (ProfileContentSchema in
-- @resumaker/shared) and app/api/profile/route.ts.
--
-- Also drops the industry/category concept entirely (resumes.industry,
-- generations.industry — the latter was already dead, nothing wrote to
-- it) and adds resumes.job_title/company_name, which is what "My
-- Resumes" displays going forward instead of a free-text title. Older
-- resumes keep working with a null job_title/company_name — the UI
-- falls back to the existing `title` column for those.
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"resume_locale" varchar(8) DEFAULT 'auto' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "job_title" varchar(200);
--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "company_name" varchar(200);
--> statement-breakpoint
ALTER TABLE "resumes" DROP COLUMN "industry";
--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "industry";
