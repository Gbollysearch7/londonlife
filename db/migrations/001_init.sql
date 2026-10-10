-- London Life — Milestone 1 schema.
-- Money is integer pence. Every mutation of cash writes a ledger entry in the same transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE,
  password_hash      text NOT NULL,
  adult_confirmed_at timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE characters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  name              text NOT NULL,
  appearance        jsonb NOT NULL,
  traits            text[] NOT NULL CHECK (array_length(traits, 1) = 2 AND traits[1] <> traits[2]),
  ambition          text NOT NULL,
  origin_id         text NOT NULL,
  content_version   int NOT NULL,
  location          text NOT NULL,
  cash_pence        bigint NOT NULL CHECK (cash_pence >= 0),
  stars             int NOT NULL DEFAULT 0 CHECK (stars >= 0),
  reputation_xp     int NOT NULL DEFAULT 0,
  hunger            double precision NOT NULL,
  energy            double precision NOT NULL,
  fun               double precision NOT NULL,
  social            double precision NOT NULL,
  hygiene           double precision NOT NULL,
  bladder           double precision NOT NULL,
  needs_settled_at  timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE homes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
  tier_id       text NOT NULL,
  district      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id      text NOT NULL,
  xp            int NOT NULL DEFAULT 0 CHECK (xp >= 0),
  best_level    int NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  PRIMARY KEY (character_id, skill_id)
);

CREATE TABLE ledger_entries (
  id             bigserial PRIMARY KEY,
  character_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  category       text NOT NULL,
  description    text NOT NULL,
  amount_pence   bigint NOT NULL,
  balance_after  bigint NOT NULL CHECK (balance_after >= 0),
  ref_type       text,
  ref_id         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_by_character ON ledger_entries (character_id, id DESC);

CREATE TABLE inventory (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id       text NOT NULL,
  qty           int NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (character_id, item_id)
);

CREATE TABLE furniture (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  def_id          text NOT NULL,
  home_id         uuid REFERENCES homes(id) ON DELETE SET NULL, -- NULL means in storage
  x               int,
  y               int,
  rot             int NOT NULL DEFAULT 0 CHECK (rot IN (0, 90, 180, 270)),
  colour          text NOT NULL,
  price_pence     bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((home_id IS NULL AND x IS NULL AND y IS NULL) OR (home_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL))
);

CREATE TABLE activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  def_id        text NOT NULL,
  param         text,
  location      text NOT NULL,
  status        text NOT NULL CHECK (status IN ('running', 'completed', 'cancelled')),
  started_at    timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  settled_at    timestamptz,
  cost_pence    bigint NOT NULL DEFAULT 0,
  period_key    text NOT NULL,
  result        jsonb
);
CREATE UNIQUE INDEX one_running_activity ON activities (character_id) WHERE status = 'running';
CREATE INDEX activities_by_period ON activities (character_id, period_key, def_id);

CREATE TABLE journeys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  origin        text NOT NULL,
  destination   text NOT NULL,
  mode          text NOT NULL,
  fare_pence    bigint NOT NULL,
  status        text NOT NULL CHECK (status IN ('in_transit', 'arrived', 'cancelled')),
  departed_at   timestamptz NOT NULL,
  arrives_at    timestamptz NOT NULL,
  settled_at    timestamptz
);
CREATE UNIQUE INDEX one_active_journey ON journeys (character_id) WHERE status = 'in_transit';

CREATE TABLE game_events (
  id            bigserial PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  type          text NOT NULL,
  data          jsonb NOT NULL DEFAULT '{}',
  period_key    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_by_period ON game_events (character_id, period_key, type);

CREATE TABLE mission_assignments (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  mission_ids   text[] NOT NULL,
  swaps_used    int NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, period_key)
);

CREATE TABLE mission_claims (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  mission_id    text NOT NULL,
  reward        jsonb NOT NULL,
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, period_key, mission_id)
);

CREATE TABLE once_rewards (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  reward_key    text NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, reward_key)
);

CREATE TABLE idempotency_keys (
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key           text NOT NULL,
  command       text NOT NULL,
  response      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, key)
);
