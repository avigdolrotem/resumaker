ALTER TABLE "generations" ADD COLUMN "detected_locale" varchar(8);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "industry" varchar(32);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "input_length" integer;--> statement-breakpoint
CREATE INDEX "generations_user_created_idx" ON "generations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "generations_resume_id_idx" ON "generations" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resumes_user_active_updated_idx" ON "resumes" USING btree ("user_id","updated_at" DESC NULLS LAST) WHERE "resumes"."deleted_at" IS NULL;
