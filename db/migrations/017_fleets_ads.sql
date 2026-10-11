-- Milestone 5 · Transport company (courier firm with a daily contract board) and city advertising
-- (weekly billboard slots with preset templates only). Spec ch. 17 and 27.

-- The courier contract a vehicle is out on, until that contract settles. A car on a contract can't be
-- driven, serviced or sold.
ALTER TABLE vehicles ADD COLUMN contract_id uuid;

CREATE TABLE courier_firms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    uuid NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
  -- Built from preset name parts, never typed.
  name            text NOT NULL,
  xp              int NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level           int NOT NULL DEFAULT 1 CHECK (level >= 1),
  contracts_done  int NOT NULL DEFAULT 0,
  founded_at      timestamptz NOT NULL
);

CREATE TABLE courier_contracts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id        uuid NOT NULL REFERENCES courier_firms(id) ON DELETE CASCADE,
  character_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  -- The board listing: London day and slot. Each firm can run each listing once.
  day_key        text NOT NULL,
  slot           int NOT NULL,
  tier           text NOT NULL,
  pickup         text NOT NULL,
  dropoff        text NOT NULL,
  goods          text NOT NULL,
  pay_pence      bigint NOT NULL CHECK (pay_pence >= 0),
  driver_pence   bigint NOT NULL CHECK (driver_pence >= 0),
  fuel_pence     bigint NOT NULL CHECK (fuel_pence >= 0),
  wear           int NOT NULL,
  status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'abandoned')),
  started_at     timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  deadline_at    timestamptz NOT NULL,
  settled_at     timestamptz,
  -- Filled on completion: the London week it counts towards for business tax, and what was paid out.
  week_key       text,
  taxable_pence  bigint NOT NULL DEFAULT 0,
  tax_pence      bigint NOT NULL DEFAULT 0,
  paid_pence     bigint NOT NULL DEFAULT 0,
  UNIQUE (firm_id, day_key, slot)
);
CREATE INDEX courier_contracts_running ON courier_contracts (character_id) WHERE status = 'running';
CREATE INDEX courier_contracts_day ON courier_contracts (firm_id, day_key);

-- One row per advertising site and week, locked while a slot is sold so the limit holds under races.
CREATE TABLE ad_site_weeks (
  site_id   text NOT NULL,
  week_key  text NOT NULL,
  PRIMARY KEY (site_id, week_key)
);

CREATE TABLE ad_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  site_id        text NOT NULL,
  week_key       text NOT NULL,
  slot           int NOT NULL,
  week_start     timestamptz NOT NULL,
  week_end       timestamptz NOT NULL,
  -- Preset choices only; brand_text is your character name or your firm's preset name at booking time.
  template       text NOT NULL,
  colour         text NOT NULL,
  slogan         text NOT NULL,
  brand          text NOT NULL CHECK (brand IN ('name', 'firm')),
  brand_text     text NOT NULL,
  price_pence    bigint NOT NULL CHECK (price_pence >= 0),
  status         text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'refunded')),
  refund_reason  text,
  -- Set once the week has started and the site was confirmed able to show it (or it was refunded).
  start_checked  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL,
  ended_at       timestamptz
);
CREATE UNIQUE INDEX ad_slot_taken ON ad_bookings (site_id, week_key, slot) WHERE status = 'booked';
CREATE UNIQUE INDEX ad_one_per_site ON ad_bookings (character_id, site_id, week_key) WHERE status = 'booked';
CREATE INDEX ad_bookings_week ON ad_bookings (week_key) WHERE status = 'booked';
