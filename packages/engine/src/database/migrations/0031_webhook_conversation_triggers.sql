-- Add conversation trigger fields to event_definitions
ALTER TABLE "event_definitions" ADD COLUMN "action" varchar(20) NOT NULL DEFAULT 'backlog';
ALTER TABLE "event_definitions" ADD COLUMN "context_prompt" text;
ALTER TABLE "event_definitions" ADD COLUMN "outbound_channel" varchar(50);
ALTER TABLE "event_definitions" ADD COLUMN "outbound_target" text;

-- Add context prompt persistence to conversations
ALTER TABLE "conversations" ADD COLUMN "context_prompt" text;
