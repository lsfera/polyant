-- Per-instance "extended thinking" toggle.
--
-- The Vercel AI SDK accepts a `thinking` flag that, when forwarded as
-- providerOptions, enables reasoning content on Anthropic Claude 3.7+ /
-- Claude 4 models and on OpenAI o-series / gpt-5 reasoning models. The
-- supervisor reads this column via config-resolver and propagates the flag
-- to ai-gateway only when the currently selected model is thinking-capable
-- (gate enforced at runtime — see ai-gateway/config.ts isThinkingCapable).

ALTER TABLE "instances" ADD COLUMN "thinking_enabled" boolean NOT NULL DEFAULT false;
