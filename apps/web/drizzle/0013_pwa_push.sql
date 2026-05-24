-- M8: PWA push subscriptions

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     text          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"    text          NOT NULL UNIQUE,
  "p256dh"      text          NOT NULL,
  "auth"        text          NOT NULL,
  "created_at"  timestamptz   NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
