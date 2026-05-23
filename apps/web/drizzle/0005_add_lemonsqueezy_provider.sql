CREATE TABLE "ls_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ls_customer_id" varchar(64);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ls_subscription_id" varchar(64);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ls_variant_id" varchar(64);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ls_customer_portal_url" text;--> statement-breakpoint
CREATE INDEX "ls_events_name_idx" ON "ls_webhook_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "ls_events_processed_idx" ON "ls_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "subscriptions_ls_customer_idx" ON "subscriptions" USING btree ("ls_customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_provider_idx" ON "subscriptions" USING btree ("provider");
