CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  game_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key VARCHAR(24) NOT NULL,
  sport TEXT NOT NULL,
  game_id TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'NEW',   -- NEW/DELIVERED/ACKED/EXPIRED
  score INT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_alerts_key ON alerts(alert_key);

CREATE TABLE alert_cooldowns (
  sport TEXT NOT NULL,
  game_id TEXT NOT NULL,
  type TEXT NOT NULL,
  until TIMESTAMPTZ NOT NULL,
  UNIQUE(sport, game_id, type)
);