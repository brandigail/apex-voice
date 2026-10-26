CREATE TABLE IF NOT EXISTS feedback (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  message     text NOT NULL,
  screen      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC)
