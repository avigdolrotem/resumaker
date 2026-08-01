ALTER TABLE "notifications" ADD COLUMN "pushed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_pending_push_idx" ON "notifications" USING btree ("created_at") WHERE "notifications"."read_at" IS NULL AND "notifications"."pushed_at" IS NULL;
