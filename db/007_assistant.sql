ALTER TABLE drafts ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "calendarUrl" text;
CREATE TABLE IF NOT EXISTS agenda_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  title       text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_items_user_start_idx ON agenda_items (user_id, starts_at)
