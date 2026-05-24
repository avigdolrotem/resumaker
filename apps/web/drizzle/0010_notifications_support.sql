-- M9: in-app notifications + support tickets.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     text          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"        varchar(48)   NOT NULL,
  "title"       text          NOT NULL,
  "body"        text,
  "link"        text,
  "read_at"     timestamptz,
  "created_at"  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx"  ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications"("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     text REFERENCES "users"("id") ON DELETE SET NULL,
  "email"       varchar(320)  NOT NULL,
  "subject"     varchar(200)  NOT NULL,
  "body"        text          NOT NULL,
  "status"      varchar(16)   NOT NULL DEFAULT 'open',
  "replied_at"  timestamptz,
  "created_at"  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_tickets_status_created_idx" ON "support_tickets"("status", "created_at" DESC);
