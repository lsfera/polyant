-- Fix: add columns that may be missing from knowledge_documents.
-- The original 0010 migration used CREATE TABLE IF NOT EXISTS, which is a
-- no-op when the table already exists (e.g. from a prior RAG attempt that
-- created the table without these columns).  These ALTER statements are
-- idempotent (IF NOT EXISTS) so they are safe on both fresh and patched DBs.
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "raw_content" text NOT NULL DEFAULT '';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "content_hash" text NOT NULL DEFAULT '';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'upload';

-- Same fix for knowledge_chunks (chunk_index added after initial table creation)
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "chunk_index" integer NOT NULL DEFAULT 0;
