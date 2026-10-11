-- Milestone 3 · Shared economy: player marketplace, player companies and the player jobs board (spec ch. 16, 18).

-- A furniture instance listed for sale. While a listing is active the item is locked: it can't be placed, sold or listed again.
CREATE TABLE market_listings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  furniture_id  uuid NOT NULL REFERENCES furniture(id) ON DELETE CASCADE,
  def_id        text NOT NULL,
  colour        text NOT NULL,
  price_pence   bigint NOT NULL CHECK (price_pence > 0),
  fee_pence     bigint NOT NULL DEFAULT 0 CHECK (fee_pence >= 0),
  status        text NOT NULL CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_id      uuid REFERENCES characters(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL,
  closed_at     timestamptz
);
CREATE UNIQUE INDEX one_active_listing_per_item ON market_listings (furniture_id) WHERE status = 'active';
CREATE INDEX market_active ON market_listings (status, created_at DESC);

-- One company per character.
CREATE TABLE companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id        uuid NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
  name                text NOT NULL,
  sector              text NOT NULL,
  level               int NOT NULL DEFAULT 1 CHECK (level >= 1),
  progress            int NOT NULL DEFAULT 0 CHECK (progress >= 0),
  -- Losses are carried forward against future profit; the founder's wallet is never charged for a bad day.
  loss_carried_pence  bigint NOT NULL DEFAULT 0 CHECK (loss_carried_pence >= 0),
  -- London day key of the last 18:00 settlement already processed.
  settled_through     text NOT NULL,
  founded_at          timestamptz NOT NULL
);

-- Each finished work session, counted towards the settlement period it falls in.
CREATE TABLE company_work (
  activity_id   uuid PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  progress      int NOT NULL,
  created_at    timestamptz NOT NULL
);
CREATE INDEX company_work_by_period ON company_work (company_id, period_key);

-- One settlement per company per London day: a second run of the same period is a no-op.
CREATE TABLE company_settlements (
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_key     text NOT NULL,
  week_key       text NOT NULL,
  sessions       int NOT NULL,
  roll           double precision NOT NULL,
  takings_pence  bigint NOT NULL,
  costs_pence    bigint NOT NULL,
  profit_pence   bigint NOT NULL,
  offset_pence   bigint NOT NULL DEFAULT 0,
  taxable_pence  bigint NOT NULL DEFAULT 0,
  tax_pence      bigint NOT NULL DEFAULT 0,
  paid_pence     bigint NOT NULL DEFAULT 0,
  level_after    int NOT NULL,
  created_at     timestamptz NOT NULL,
  PRIMARY KEY (company_id, period_key)
);

-- Player-posted paid tasks. Money is held in escrow from posting until it is released or refunded.
CREATE TABLE player_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  worker_id     uuid REFERENCES characters(id) ON DELETE SET NULL,
  template_id   text NOT NULL,
  pay_pence     bigint NOT NULL CHECK (pay_pence > 0),
  status        text NOT NULL CHECK (status IN ('posted', 'applied', 'hired', 'submitted', 'completed', 'cancelled', 'expired')),
  deadline_at   timestamptz NOT NULL,
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL,
  closed_at     timestamptz,
  CHECK (worker_id IS NULL OR worker_id <> poster_id)
);
CREATE INDEX player_jobs_open ON player_jobs (status, created_at DESC);

CREATE TABLE escrow_holds (
  job_id        uuid PRIMARY KEY REFERENCES player_jobs(id) ON DELETE CASCADE,
  payer_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  payee_id      uuid REFERENCES characters(id) ON DELETE SET NULL,
  amount_pence  bigint NOT NULL CHECK (amount_pence > 0),
  status        text NOT NULL CHECK (status IN ('held', 'released', 'refunded')),
  created_at    timestamptz NOT NULL,
  settled_at    timestamptz
);
