-- Milestone 5 · Late-game assets: vehicles, weekly insurance with seeded hazards, pets (spec ch. 14, 24, 34).
-- Prestige furniture reuses the furniture table; premiums and upkeep reuse the bills table.

CREATE TABLE vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id       uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  def_id             text NOT NULL,
  colour             text NOT NULL,
  price_pence        bigint NOT NULL CHECK (price_pence >= 0),
  condition          int NOT NULL DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
  -- Where it's parked; it travels with you when you ride or drive it.
  location           text NOT NULL DEFAULT 'home',
  -- The journey it's being used for, until that journey settles.
  journey_id         uuid,
  journey_origin     text,
  trips              int NOT NULL DEFAULT 0,
  -- Weekly upkeep that couldn't be paid: the vehicle stays off the road until it's settled.
  owed_pence         bigint NOT NULL DEFAULT 0 CHECK (owed_pence >= 0),
  status             text NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'sold', 'stolen')),
  bought_at          timestamptz NOT NULL,
  delivered_at       timestamptz NOT NULL,
  ended_at           timestamptz
);
CREATE INDEX vehicles_owned ON vehicles (character_id) WHERE status = 'owned';

-- Per-character schedule for weekly late-game charges and the hazard check.
CREATE TABLE late_game_state (
  character_id           uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  bills_due_at           timestamptz NOT NULL,
  hazards_checked_until  timestamptz NOT NULL
);

CREATE TABLE insurance_policies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('home', 'possessions')),
  started_at    timestamptz NOT NULL,
  -- Set when cancelled (cover runs to the end of the paid week) or lapsed (unpaid premium).
  ended_at      timestamptz,
  end_reason    text CHECK (end_reason IN ('cancelled', 'lapsed')),
  renews        boolean NOT NULL DEFAULT true
);
-- At most one renewing policy of each kind.
CREATE UNIQUE INDEX insurance_one_renewing ON insurance_policies (character_id, kind) WHERE renews;

-- One incident at most per character per insurance week (Saturday 09:00 to Saturday 09:00).
CREATE TABLE hazard_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id           uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  week_key               text NOT NULL,
  kind                   text NOT NULL,
  occurred_at            timestamptz NOT NULL,
  affected               text NOT NULL,
  vehicle_id             uuid,
  assessed_loss_pence    bigint NOT NULL,
  charged_pence          bigint NOT NULL DEFAULT 0,
  item_value_pence       bigint NOT NULL DEFAULT 0,
  hardship_relief_pence  bigint NOT NULL DEFAULT 0,
  insured                boolean NOT NULL,
  policy_kind            text,
  excess_pence           bigint NOT NULL DEFAULT 0,
  payout_pence           bigint NOT NULL DEFAULT 0,
  claimed_at             timestamptz,
  UNIQUE (character_id, week_key)
);

CREATE TABLE pets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('cat', 'dog')),
  name          text NOT NULL,
  colour        text NOT NULL,
  wellbeing     numeric NOT NULL CHECK (wellbeing BETWEEN 0 AND 100),
  settled_at    timestamptz NOT NULL,
  -- Last time of each care action, for cooldowns: {"feed": "2026-…"}.
  last_care     jsonb NOT NULL DEFAULT '{}',
  prompted      boolean NOT NULL DEFAULT false,
  adopted_at    timestamptz NOT NULL,
  rehomed_at    timestamptz
);
CREATE INDEX pets_current ON pets (character_id) WHERE rehomed_at IS NULL;
