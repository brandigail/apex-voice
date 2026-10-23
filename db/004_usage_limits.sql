CREATE TABLE IF NOT EXISTS "rateLimit" ("id" text NOT NULL PRIMARY KEY, "key" text NOT NULL UNIQUE, "count" integer NOT NULL, "lastRequest" bigint NOT NULL);

CREATE TABLE IF NOT EXISTS api_usage (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  endpoint    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_endpoint_created_idx ON api_usage (endpoint, created_at);

CREATE INDEX IF NOT EXISTS api_usage_user_endpoint_created_idx ON api_usage (user_id, endpoint, created_at);
