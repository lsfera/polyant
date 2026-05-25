CREATE TABLE IF NOT EXISTS "instance_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "key" varchar(100) NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_secret_key" UNIQUE("instance_id", "key")
);

CREATE TABLE IF NOT EXISTS "instance_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "channel_type" varchar(50) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "config" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_channel_type" UNIQUE("instance_id", "channel_type")
);
