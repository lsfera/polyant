-- Phase 1: FS-to-DB config layer tables
-- New tables: tools, skills, skill_versions, skill_tools,
--             instance_prompts, instance_tools, instance_skills
-- Modified: instance_skill_env (add FK to skills.slug)

-- 1. tools — registry of all available tools
CREATE TABLE IF NOT EXISTS "tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL UNIQUE,
  "description" text NOT NULL,
  "category" varchar(50) NOT NULL DEFAULT 'general',
  "required_secrets" jsonb NOT NULL DEFAULT '[]',
  "is_meta" boolean NOT NULL DEFAULT false,
  "is_global" boolean NOT NULL DEFAULT false,
  "synced_at" timestamp DEFAULT now()
);

-- 2. skills — global skill library
CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "category" varchar(100) NOT NULL DEFAULT 'general',
  "current_version_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- 3. skill_versions — versioned skill content
CREATE TABLE IF NOT EXISTS "skill_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "version" varchar(50) NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "scripts" jsonb NOT NULL DEFAULT '[]',
  "changelog" text,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_skill_version" UNIQUE("skill_id", "version")
);

CREATE INDEX IF NOT EXISTS "idx_skill_versions_skill" ON "skill_versions" ("skill_id");

-- 4. skill_tools — junction: skill → tool dependencies
CREATE TABLE IF NOT EXISTS "skill_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "tool_id" uuid NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_skill_tool" UNIQUE("skill_id", "tool_id")
);

-- 5. instance_prompts — per-instance prompt sections
CREATE TABLE IF NOT EXISTS "instance_prompts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "section_key" varchar(50) NOT NULL,
  "title" varchar(100) NOT NULL,
  "content" text NOT NULL,
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_prompt_section" UNIQUE("instance_id", "section_key")
);

CREATE INDEX IF NOT EXISTS "idx_instance_prompts_instance" ON "instance_prompts" ("instance_id");

-- 6. instance_tools — per-instance enabled tools
CREATE TABLE IF NOT EXISTS "instance_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "tool_id" uuid NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
  "source" varchar(20) NOT NULL DEFAULT 'manual',
  "enabled_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_tool" UNIQUE("instance_id", "tool_id")
);

CREATE INDEX IF NOT EXISTS "idx_instance_tools_instance" ON "instance_tools" ("instance_id");

-- 7. instance_skills — per-instance skill assignments
CREATE TABLE IF NOT EXISTS "instance_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "instances"("id") ON DELETE CASCADE,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "skill_version_id" uuid NOT NULL REFERENCES "skill_versions"("id") ON DELETE RESTRICT,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_instance_skill" UNIQUE("instance_id", "skill_id")
);

CREATE INDEX IF NOT EXISTS "idx_instance_skills_instance" ON "instance_skills" ("instance_id");

-- 8. FK from instance_skill_env.skill_slug → skills.slug
-- DEFERRED to Fase 2 migration script: must populate `skills` table first,
-- otherwise the FK will fail if instance_skill_env has existing rows.
-- See: scripts/migrate-fs-to-db.ts
