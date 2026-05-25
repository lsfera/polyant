-- Add channel and user_identifier columns to conversations
ALTER TABLE "conversations" ADD COLUMN "channel" text DEFAULT 'web';
ALTER TABLE "conversations" ADD COLUMN "user_identifier" text;

-- Add indexes for analytics queries on conversations
CREATE INDEX IF NOT EXISTS "idx_conversations_instance_created" ON "conversations" ("instance_id", "created_at");

-- Backfill channel from conversation_id prefix for existing rows
UPDATE "conversations" SET channel = 'telegram' WHERE conversation_id LIKE 'telegram:%' AND (channel IS NULL OR channel = 'web');
UPDATE "conversations" SET channel = 'slack' WHERE conversation_id LIKE 'slack:%' AND (channel IS NULL OR channel = 'web');
UPDATE "conversations" SET channel = 'whatsapp' WHERE conversation_id LIKE 'whatsapp:%' AND (channel IS NULL OR channel = 'web');

-- Add indexes for analytics queries on ai_logs
CREATE INDEX IF NOT EXISTS "idx_ai_logs_instance_id" ON "ai_logs" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_ai_logs_created_at" ON "ai_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_logs_instance_created" ON "ai_logs" ("instance_id", "created_at");
