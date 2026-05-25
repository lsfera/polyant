-- 0033_audio_stt_support.sql
-- Adds STT provider selector to instances and STT phase columns to pipeline_traces.

ALTER TABLE instances
  ADD COLUMN IF NOT EXISTS stt_provider TEXT NOT NULL DEFAULT 'openai';

ALTER TABLE pipeline_traces
  ADD COLUMN IF NOT EXISTS stt_duration_ms INTEGER NULL;

ALTER TABLE pipeline_traces
  ADD COLUMN IF NOT EXISTS stt_provider TEXT NULL;

ALTER TABLE pipeline_traces
  ADD COLUMN IF NOT EXISTS audio_duration_sec NUMERIC(6,2) NULL;
