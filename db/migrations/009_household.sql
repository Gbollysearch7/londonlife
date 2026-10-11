-- Milestone 2 · Household systems: weekly utilities, household staff, chef meals and house parties
-- (spec ch. 9, 12, 13, 19, 31). Utility and staff-wage bills use the existing bills table
-- (kinds 'utilities' and 'staff'; one per kind per London week via its unique key).

-- When the next household bill run (utilities + staff wages) is due: Saturdays 09:00 London, with rent.
CREATE TABLE household (
  character_id   uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  bills_due_at   timestamptz NOT NULL
);

CREATE TABLE staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('cleaner', 'chef')),
  wage_pence    bigint NOT NULL CHECK (wage_pence > 0),
  hired_at      timestamptz NOT NULL,
  ended_at      timestamptz,
  -- 'fired', 'home_too_small' or 'unpaid'.
  end_reason    text
);
-- At most one active member of staff per role.
CREATE UNIQUE INDEX staff_one_active ON staff (character_id, role) WHERE ended_at IS NULL;

-- Chef meals collected per London day (capped at three).
CREATE TABLE chef_meals (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  day_key       text NOT NULL,
  served        int NOT NULL CHECK (served BETWEEN 0 AND 3),
  PRIMARY KEY (character_id, day_key)
);

-- One row per finished house party; the guest bonus is applied once per party activity.
CREATE TABLE house_parties (
  activity_id   uuid PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  guests        jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL
);
CREATE INDEX house_parties_by_character ON house_parties (character_id, created_at DESC);
