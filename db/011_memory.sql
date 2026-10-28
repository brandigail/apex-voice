CREATE TABLE IF NOT EXISTS memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'fact' CHECK (kind IN ('preference', 'fact')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_user_idx ON memories (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  relationship  text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts (user_id, created_at DESC)
