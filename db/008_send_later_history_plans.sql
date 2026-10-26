ALTER TABLE drafts ADD COLUMN IF NOT EXISTS send_at timestamptz;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS drafts_user_send_at_idx ON drafts (user_id, send_at) WHERE sent_at IS NULL AND send_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS assistant_messages (
  id               bigserial PRIMARY KEY,
  user_id          text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  conversation_id  uuid NOT NULL,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  actions          jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_messages_user_created_idx ON assistant_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_messages_conversation_idx ON assistant_messages (conversation_id, id);
CREATE TABLE IF NOT EXISTS plan_interest (
  user_id     text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  plan        text NOT NULL,
  currency    text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
