CREATE TABLE IF NOT EXISTS subscriptions (
  user_id           text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  plan              text NOT NULL,
  status            text NOT NULL CHECK (status IN ('pending', 'active', 'cancelled')),
  amount_zar        numeric(10, 2) NOT NULL,
  display_currency  text NOT NULL,
  m_payment_id      uuid NOT NULL,
  pf_token          text,
  last_payment_at   timestamptz,
  next_billing_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_m_payment_idx ON subscriptions (m_payment_id);
CREATE TABLE IF NOT EXISTS payments (
  pf_payment_id  text PRIMARY KEY,
  user_id        text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  m_payment_id   uuid NOT NULL,
  amount_gross   numeric(10, 2) NOT NULL,
  status         text NOT NULL,
  emailed        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
)
