-- Add credentials columns to users for email/password login + admin role.
-- All columns are nullable / have safe defaults so existing OAuth-only users
-- keep working unchanged (passwordHash NULL means "OAuth only, cannot login
-- via /api/auth/credentials/verify").

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;
