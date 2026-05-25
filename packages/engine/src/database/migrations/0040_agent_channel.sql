-- Agent-to-agent: extend pipeline_traces with parent-call linkage so the
-- analytics UI can render call chains across instances.
--
-- The `agent` channel type itself does not need a schema change in
-- `instance_channels` — that table already stores channelType as text.
-- Enabling the row (with channelConfigSchemas["agent"] = passthrough)
-- is the toggle that makes the instance reachable as a callee.

ALTER TABLE pipeline_traces
  ADD COLUMN IF NOT EXISTS parent_conversation_id text,
  ADD COLUMN IF NOT EXISTS parent_trace_id uuid;

CREATE INDEX IF NOT EXISTS idx_pipeline_traces_parent_conv
  ON pipeline_traces(parent_conversation_id)
  WHERE parent_conversation_id IS NOT NULL;
