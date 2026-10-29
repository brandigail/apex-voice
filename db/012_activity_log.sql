CREATE TABLE IF NOT EXISTS activity_log (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  kind        text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON activity_log (user_id, created_at DESC)
