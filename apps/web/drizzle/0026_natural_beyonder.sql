CREATE UNIQUE INDEX "trusted_sharer_requests_one_pending_per_user" ON "trusted_sharer_requests" USING btree ("user_id") WHERE "trusted_sharer_requests"."status" = 'pending';
