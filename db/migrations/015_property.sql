-- Milestone 5 · Investment homes, land plots and staged construction (spec ch. 11, 17).
-- Investment homes are a separate product from the character's residence (homes table).

CREATE TABLE investment_properties (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  def_id            text NOT NULL,
  source            text NOT NULL CHECK (source IN ('bought', 'built')),
  -- The plot it was built on, for self-built homes.
  plot_id           uuid,
  price_paid_pence  bigint NOT NULL CHECK (price_paid_pence >= 0),
  bought_at         timestamptz NOT NULL,
  -- The next Saturday 09:00 when a week's rent and upkeep settle.
  income_due_at     timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'sold')),
  sold_at           timestamptz,
  sale_pence        bigint
);
CREATE INDEX investment_properties_owned ON investment_properties (character_id) WHERE status = 'owned';
-- A plot becomes at most one building.
CREATE UNIQUE INDEX investment_properties_plot ON investment_properties (plot_id) WHERE plot_id IS NOT NULL;

-- One row per property per income week: the unique key stops a week ever paying twice.
CREATE TABLE property_income (
  id                 bigserial PRIMARY KEY,
  property_id        uuid NOT NULL REFERENCES investment_properties(id) ON DELETE CASCADE,
  character_id       uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_key         text NOT NULL,
  occupied           boolean NOT NULL,
  rent_pence         bigint NOT NULL,
  maintenance_pence  bigint NOT NULL,
  net_pence          bigint NOT NULL,
  due_at             timestamptz NOT NULL,
  created_at         timestamptz NOT NULL,
  UNIQUE (property_id, period_key)
);
CREATE INDEX property_income_character ON property_income (character_id, id DESC);

CREATE TABLE land_plots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  def_id            text NOT NULL,
  price_paid_pence  bigint NOT NULL CHECK (price_paid_pence >= 0),
  bought_at         timestamptz NOT NULL,
  -- owned: bare or under construction · built: now an investment home · sold: sold as bare land.
  status            text NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'built', 'sold')),
  stages_done       int NOT NULL DEFAULT 0 CHECK (stages_done BETWEEN 0 AND 4),
  -- Money in completed stages plus any stage running now.
  spent_pence       bigint NOT NULL DEFAULT 0 CHECK (spent_pence >= 0),
  building_id       uuid,
  ended_at          timestamptz,
  sale_pence        bigint
);
CREATE INDEX land_plots_owned ON land_plots (character_id) WHERE status = 'owned';

-- Each stage of work on a plot. A stage index completes at most once, and only one runs at a time.
CREATE TABLE construction_stages (
  id            bigserial PRIMARY KEY,
  plot_id       uuid NOT NULL REFERENCES land_plots(id) ON DELETE CASCADE,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  stage         int NOT NULL CHECK (stage BETWEEN 0 AND 3),
  cost_pence    bigint NOT NULL CHECK (cost_pence >= 0),
  started_at    timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
  settled_at    timestamptz,
  refund_pence  bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX construction_one_running ON construction_stages (plot_id) WHERE status = 'running';
CREATE UNIQUE INDEX construction_stage_once ON construction_stages (plot_id, stage) WHERE status = 'completed';
