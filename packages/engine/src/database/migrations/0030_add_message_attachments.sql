-- Add attachments metadata column to conversation_messages.
-- Stores an array of {type, mimeType, fileName, s3Key, sizeBytes} objects (no binary data).
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS attachments jsonb;
