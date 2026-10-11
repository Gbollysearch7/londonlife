-- Milestone 2 · Economy: rent and ownership, savings, bills, wardrobe and courses (spec ch. 9, 11, 15, 34).

ALTER TABLE homes ADD COLUMN owned boolean NOT NULL DEFAULT false;
ALTER TABLE homes ADD COLUMN rent_pence bigint NOT NULL DEFAULT 0;
ALTER TABLE homes ADD COLUMN deposit_pence bigint NOT NULL DEFAULT 0;
-- NULL until first settled; the server then schedules the next Saturday 09:00 London.
ALTER TABLE homes ADD COLUMN rent_due_at timestamptz;
ALTER TABLE homes ADD COLUMN rent_free_until timestamptz;

ALTER TABLE characters ADD COLUMN savings_pence bigint NOT NULL DEFAULT 0 CHECK (savings_pence >= 0);
ALTER TABLE characters ADD COLUMN savings_credited_day text;

CREATE TABLE savings_entries (
  id             bigserial PRIMARY KEY,
  character_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('deposit', 'withdraw', 'interest')),
  amount_pence   bigint NOT NULL,
  balance_after  bigint NOT NULL CHECK (balance_after >= 0),
  period_key     text,
  created_at     timestamptz NOT NULL
);
-- Interest is credited once per London day.
CREATE UNIQUE INDEX savings_interest_once ON savings_entries (character_id, period_key) WHERE kind = 'interest';

CREATE TABLE bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  period_key    text NOT NULL,
  description   text NOT NULL,
  amount_pence  bigint NOT NULL,
  status        text NOT NULL CHECK (status IN ('paid', 'covered', 'unpaid')),
  due_at        timestamptz NOT NULL,
  paid_at       timestamptz,
  UNIQUE (character_id, kind, period_key)
);

CREATE TABLE owned_garments (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id       text NOT NULL,
  price_pence   bigint NOT NULL,
  bought_at     timestamptz NOT NULL,
  PRIMARY KEY (character_id, item_id)
);

CREATE TABLE course_progress (
  character_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  course_id        text NOT NULL,
  lessons_passed   int NOT NULL DEFAULT 0 CHECK (lessons_passed BETWEEN 0 AND 5),
  -- Set when a class finishes: that lesson's quiz is waiting.
  pending_lesson   int,
  attempts         jsonb NOT NULL DEFAULT '[]',
  certified_at     timestamptz,
  PRIMARY KEY (character_id, course_id)
);
