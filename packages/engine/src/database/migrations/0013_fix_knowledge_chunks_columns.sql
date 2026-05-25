-- Fix: add chunk_index column missing from knowledge_chunks.
-- Same root cause as 0012: CREATE TABLE IF NOT EXISTS in 0010 was a no-op
-- because the table existed from a prior RAG attempt without this column.
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "chunk_index" integer NOT NULL DEFAULT 0;
