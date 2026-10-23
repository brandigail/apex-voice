CREATE TABLE IF NOT EXISTS drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL CHECK (category IN ('EMAIL', 'QUOTE', 'SMS', 'NOTE')),
  recipient   text NOT NULL DEFAULT '',
  subject     text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  transcript  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drafts_created_at_idx ON drafts (created_at DESC);
