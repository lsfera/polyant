-- Reasoning + Tool Steps persistence
--
-- 1) Rename `tool_calls` to `steps` and change semantics:
--    OLD: jsonb array of [{ toolName, args, result }]
--    NEW: jsonb array of StepDetail[] (see conversations/schema.ts for the type)
--
-- 2) Add `reasoning` column for thinking/reasoning content (Anthropic signed
--    blocks + OpenAI reasoning summaries). Used both for UI display and for
--    Anthropic multi-turn signed-block re-injection.
--
-- 3) Backfill legacy rows in-place: each old `[{toolName,args,result}]` element
--    becomes a synthetic StepDetail with `legacy: true` so the UI can flag it.
--    Idempotent: skips rows already in the new shape.
--
-- 4) Extend `ai_logs` with `reasoning_chars` and `step_count` for analytics
--    (no reasoning content stored here — that lives on conversation_messages).

-- Step 1+2: rename + add reasoning column
ALTER TABLE "conversation_messages" RENAME COLUMN "tool_calls" TO "steps";
ALTER TABLE "conversation_messages" ADD COLUMN "reasoning" jsonb;

-- Step 3: backfill legacy rows.
-- Guard: only transform rows that match the legacy shape (have `toolName` key)
-- AND are not already in the new shape (no `stepType` key on the first element).
UPDATE "conversation_messages"
SET "steps" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'index', (idx - 1)::int,
      'stepType', 'tool-result',
      'text', '',
      'toolCalls', jsonb_build_array(jsonb_build_object(
        'toolCallId', 'legacy-' || (idx - 1)::text,
        'toolName', tc->>'toolName',
        'args', COALESCE(tc->'args', '{}'::jsonb)
      )),
      'toolResults', jsonb_build_array(jsonb_build_object(
        'toolCallId', 'legacy-' || (idx - 1)::text,
        'result', tc->'result'
      )),
      'finishReason', 'tool-calls',
      'durationMs', 0,
      'legacy', true
    ) ORDER BY idx
  )
  FROM jsonb_array_elements("steps") WITH ORDINALITY AS arr(tc, idx)
)
WHERE "steps" IS NOT NULL
  AND jsonb_typeof("steps") = 'array'
  AND jsonb_array_length("steps") > 0
  AND "steps"->0 ? 'toolName'
  AND NOT ("steps"->0 ? 'stepType');

-- Step 4: extend ai_logs with analytics counters for reasoning + steps
ALTER TABLE "ai_logs" ADD COLUMN "reasoning_chars" integer NOT NULL DEFAULT 0;
ALTER TABLE "ai_logs" ADD COLUMN "step_count" integer NOT NULL DEFAULT 0;
