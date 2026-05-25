-- Scheduled tasks table: per-instance scheduled task definitions
CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "schedule" jsonb NOT NULL,
  "prompt" text NOT NULL,

  -- State tracking
  "next_run_at" timestamp,
  "last_run_at" timestamp,
  "last_run_status" varchar(20),
  "last_error" text,
  "last_conversation_id" text,
  "consecutive_errors" integer NOT NULL DEFAULT 0,
  "total_runs" integer NOT NULL DEFAULT 0,

  -- Behavior
  "delete_after_run" boolean NOT NULL DEFAULT false,
  "max_retries" integer NOT NULL DEFAULT 3,

  -- Metadata
  "created_by" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_instance" ON "scheduled_tasks" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_tasks_next_run" ON "scheduled_tasks" ("next_run_at");

-- Add source column to conversations (to distinguish user vs scheduled_task conversations)
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'user';
