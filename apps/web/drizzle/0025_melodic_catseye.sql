CREATE TABLE "trusted_sharer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"note" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	CONSTRAINT "trusted_sharer_requests_status_check" CHECK ("trusted_sharer_requests"."status" IN ('pending', 'approved', 'denied'))
);
--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_status_check";--> statement-breakpoint
ALTER TABLE "trusted_sharer_requests" ADD CONSTRAINT "trusted_sharer_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_sharer_requests" ADD CONSTRAINT "trusted_sharer_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trusted_sharer_requests_user_idx" ON "trusted_sharer_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trusted_sharer_requests_status_idx" ON "trusted_sharer_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('open', 'closed', 'unknown', 'pending'));
