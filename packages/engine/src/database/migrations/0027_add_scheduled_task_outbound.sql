ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "outbound_channel" varchar(50);
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "outbound_target" text;
ALTER TABLE "scheduled_tasks" ADD COLUMN IF NOT EXISTS "keep_history" boolean NOT NULL DEFAULT false;
