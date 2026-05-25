-- Room feature: event sources, event definitions, event backlog, room activity log, and room config
-- Tables: instance_room, event_sources, event_definitions, event_backlog, room_activity_log

-- 1. instance_room — per-instance room configuration (1:1 with instances)
CREATE TABLE IF NOT EXISTS "instance_room" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "prompt" text NOT NULL DEFAULT '',
  "outbound_channel" varchar(50),
  "outbound_target" text,
  "eval_interval_minutes" integer NOT NULL DEFAULT 5,
  "rate_limit_minutes" integer NOT NULL DEFAULT 5,
  "last_outbound_at" timestamp with time zone,
  "conversation_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_instance_room" UNIQUE("instance_id")
);

-- 2. event_sources — external event source definitions per instance
CREATE TABLE IF NOT EXISTS "event_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "config" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "webhook_token" varchar(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_event_source_webhook_token" UNIQUE("webhook_token")
);

CREATE INDEX IF NOT EXISTS "idx_event_sources_instance" ON "event_sources" ("instance_id");

-- 3. event_definitions — event types within an event source
CREATE TABLE IF NOT EXISTS "event_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_source_id" uuid NOT NULL REFERENCES "event_sources"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "matching_prompt" text NOT NULL,
  "interpretation_prompt" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_event_definitions_source" ON "event_definitions" ("event_source_id");

-- 4. event_backlog — queued events awaiting room processing
CREATE TABLE IF NOT EXISTS "event_backlog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "event_definition_id" uuid NOT NULL REFERENCES "event_definitions"("id") ON DELETE CASCADE,
  "raw_payload" jsonb NOT NULL,
  "matched_at" timestamp with time zone NOT NULL DEFAULT now(),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "completed_at" timestamp with time zone,
  "react_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_event_backlog_instance_status" ON "event_backlog" ("instance_id", "status");
CREATE INDEX IF NOT EXISTS "idx_event_backlog_definition" ON "event_backlog" ("event_definition_id");

-- 5. room_activity_log — daily activity summaries for the room
CREATE TABLE IF NOT EXISTS "room_activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "log_date" date NOT NULL,
  "log_type" varchar(10) NOT NULL,
  "content" text NOT NULL,
  "event_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_room_activity_instance_date_type" UNIQUE("instance_id", "log_date", "log_type")
);

CREATE INDEX IF NOT EXISTS "idx_room_activity_instance_date" ON "room_activity_log" ("instance_id", "log_date");
