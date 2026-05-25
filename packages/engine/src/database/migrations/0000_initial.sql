-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- Instances
CREATE TABLE "instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Instance skill environment variables
CREATE TABLE "instance_skill_env" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "skill_slug" varchar(100) NOT NULL,
  "key" varchar(255) NOT NULL,
  "value" text NOT NULL,
  "encrypted" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_skill_key" UNIQUE("instance_id", "skill_slug", "key")
);
--> statement-breakpoint

-- AI logs
CREATE TABLE "ai_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "tier" text NOT NULL,
  "thinking" boolean NOT NULL DEFAULT false,
  "prompt_tokens" integer NOT NULL,
  "completion_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "estimated_cost_usd" real NOT NULL,
  "duration_ms" integer NOT NULL,
  "conversation_id" text,
  "instance_id" text,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Conversations
CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" text NOT NULL UNIQUE,
  "summary" text,
  "instance_id" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Conversation messages
CREATE TABLE "conversation_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "tool_calls" jsonb,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_conversation_messages_conversation_id" ON "conversation_messages" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "idx_conversation_messages_created_at" ON "conversation_messages" USING btree ("created_at");
--> statement-breakpoint

-- Full-text search on messages (language-agnostic 'simple' config for multilingual support)
ALTER TABLE "conversation_messages"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;
--> statement-breakpoint
CREATE INDEX "idx_conversation_messages_search" ON "conversation_messages" USING GIN("search_vector");
--> statement-breakpoint

-- Memories with pgvector embeddings
CREATE TABLE "memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "importance" integer NOT NULL DEFAULT 5,
  "source_conversation_id" text,
  "embedding" vector(1536) NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_memories_instance_id" ON "memories" USING btree ("instance_id");
--> statement-breakpoint
CREATE INDEX "idx_memories_category" ON "memories" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "idx_memories_created_at" ON "memories" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_memories_embedding" ON "memories" USING hnsw ("embedding" vector_cosine_ops);
