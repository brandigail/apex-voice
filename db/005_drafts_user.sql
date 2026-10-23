ALTER TABLE drafts ADD COLUMN IF NOT EXISTS user_id text REFERENCES "user" ("id") ON DELETE CASCADE;

DELETE FROM drafts WHERE user_id IS NULL;

ALTER TABLE drafts ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS drafts_user_created_idx ON drafts (user_id, created_at DESC);
