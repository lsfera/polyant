-- Migration: Convert all timestamp columns to timestamptz (timestamp with time zone)
-- This is safe because PostgreSQL stores timestamps internally in UTC regardless.
-- The column type change is metadata-only — no data rewrite needed when the DB is in UTC.

-- conversations
ALTER TABLE "conversations" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "conversations" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- conversation_messages
ALTER TABLE "conversation_messages" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- memories
ALTER TABLE "memories" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "memories" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- skills
ALTER TABLE "skills" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "skills" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- skill_versions
ALTER TABLE "skill_versions" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- instances
ALTER TABLE "instances" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "instances" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_channels
ALTER TABLE "instance_channels" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "instance_channels" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_secrets
ALTER TABLE "instance_secrets" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "instance_secrets" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_prompts
ALTER TABLE "instance_prompts" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_skills
ALTER TABLE "instance_skills" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "instance_skills" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_skill_env
ALTER TABLE "instance_skill_env" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "instance_skill_env" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- instance_tools
ALTER TABLE "instance_tools" ALTER COLUMN "enabled_at" TYPE timestamptz USING "enabled_at" AT TIME ZONE 'UTC';

-- tools
ALTER TABLE "tools" ALTER COLUMN "synced_at" TYPE timestamptz USING "synced_at" AT TIME ZONE 'UTC';

-- pipeline_traces
ALTER TABLE "pipeline_traces" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- ai_logs
ALTER TABLE "ai_logs" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- knowledge_documents
ALTER TABLE "knowledge_documents" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "knowledge_documents" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- knowledge_chunks
ALTER TABLE "knowledge_chunks" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- scheduled_tasks
ALTER TABLE "scheduled_tasks" ALTER COLUMN "next_run_at" TYPE timestamptz USING "next_run_at" AT TIME ZONE 'UTC';
ALTER TABLE "scheduled_tasks" ALTER COLUMN "last_run_at" TYPE timestamptz USING "last_run_at" AT TIME ZONE 'UTC';
ALTER TABLE "scheduled_tasks" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "scheduled_tasks" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';
