-- Add PostgreSQL full-text search to knowledge_chunks so the searchKnowledge
-- tool can do hybrid search (cosine + FTS, fused with RRF) like the memory layer.
-- Pure-vector search misses chunks where the user's query keyword (e.g. "menu")
-- appears literally in the content but the surrounding semantic context is weak.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_tsv
  ON knowledge_chunks USING gin (content_tsv);
