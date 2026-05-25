-- 0034_add_message_metadata.sql
-- Adds a JSONB metadata column to conversation_messages.
-- Used to persist inbound message metadata (e.g. STT audio info).

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
