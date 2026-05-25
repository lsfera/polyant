-- Knowledge document status enum
DO $$ BEGIN
  CREATE TYPE "knowledge_document_status" AS ENUM ('uploading', 'processing', 'ready', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Knowledge documents: stores original content + metadata for RAG pipeline
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "raw_content" text NOT NULL DEFAULT '',
  "content_hash" text NOT NULL DEFAULT '',
  "source" text NOT NULL DEFAULT 'upload',
  "status" "knowledge_document_status" NOT NULL DEFAULT 'uploading',
  "chunk_count" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Backfill columns that may be missing if the table was created by a prior
-- version of this migration (before raw_content / content_hash / source existed).
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS is idempotent and safe to re-run.
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "raw_content" text NOT NULL DEFAULT '';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "content_hash" text NOT NULL DEFAULT '';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'upload';

CREATE INDEX IF NOT EXISTS "idx_knowledge_docs_instance_id"
  ON "knowledge_documents" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_docs_status"
  ON "knowledge_documents" ("status");
CREATE INDEX IF NOT EXISTS "idx_knowledge_docs_instance_hash"
  ON "knowledge_documents" ("instance_id", "content_hash");

-- Knowledge chunks: vector-embedded text segments for semantic search
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "instance_id" text NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "chunk_index" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "chunk_index" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_instance_id"
  ON "knowledge_chunks" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_document_id"
  ON "knowledge_chunks" ("document_id");
