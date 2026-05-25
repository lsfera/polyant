CREATE TABLE IF NOT EXISTS "scheduled_task_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE,
  "instance_id" text NOT NULL,
  "status" varchar(20) NOT NULL,
  "trigger_type" varchar(20) NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "duration_ms" integer,
  "output" text,
  "error" text,
  "tool_calls" jsonb DEFAULT '[]'::jsonb,
  "token_usage" jsonb DEFAULT '{}'::jsonb,
  "conversation_id" text
);

CREATE INDEX IF NOT EXISTS "idx_task_runs_instance_started" ON "scheduled_task_runs" ("instance_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_task_runs_task_started" ON "scheduled_task_runs" ("task_id", "started_at" DESC);
