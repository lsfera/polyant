CREATE TABLE "pipeline_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" uuid,
	"instance_id" text NOT NULL,
	"channel" text NOT NULL,
	"context_prep_ms" integer,
	"tool_building_ms" integer,
	"llm_call_ms" integer,
	"total_ms" integer NOT NULL,
	"ttfb_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"tool_calls" jsonb,
	"is_streaming" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_traces_instance_created" ON "pipeline_traces" USING btree ("instance_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_traces_created" ON "pipeline_traces" USING btree ("created_at");
