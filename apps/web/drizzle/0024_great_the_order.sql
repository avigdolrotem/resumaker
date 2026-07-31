ALTER TABLE "companies" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "submitted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
