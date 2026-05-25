-- Back the ON DELETE CASCADE foreign keys on accounts.user_id and sessions.user_id
-- with explicit indexes. Postgres does NOT auto-create them, so DELETE FROM users
-- previously triggered a sequential scan of both tables.
CREATE INDEX IF NOT EXISTS "idx_accounts_user_id" ON "accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id");
