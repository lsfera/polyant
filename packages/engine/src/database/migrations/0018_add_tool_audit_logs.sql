CREATE TABLE IF NOT EXISTS "tool_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" text NOT NULL,
  "conversation_id" text,
  "tool_name" varchar(100) NOT NULL,
  "action" varchar(100) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "success" boolean DEFAULT true NOT NULL,
  "error" text,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tool_audit_instance_created" ON "tool_audit_logs" ("instance_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_tool_audit_tool_created" ON "tool_audit_logs" ("tool_name", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_tool_audit_conversation" ON "tool_audit_logs" ("conversation_id");
