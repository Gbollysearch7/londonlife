-- Milestone 2 · Goals: check-in streak, wishes, perks, moodlets, ambition milestones (spec ch. 7, 20).

CREATE TABLE checkins (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  day           text NOT NULL,
  streak        int NOT NULL CHECK (streak >= 1),
  reward        jsonb NOT NULL,
  claimed_at    timestamptz NOT NULL,
  PRIMARY KEY (character_id, day)
);

CREATE TABLE wish_assignments (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  wish_ids      text[] NOT NULL,
  PRIMARY KEY (character_id, period_key)
);

CREATE TABLE wish_claims (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  wish_id       text NOT NULL,
  stars         int NOT NULL,
  claimed_at    timestamptz NOT NULL,
  PRIMARY KEY (character_id, period_key, wish_id)
);

CREATE TABLE perks (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  perk_id       text NOT NULL,
  stars         int NOT NULL,
  bought_at     timestamptz NOT NULL,
  PRIMARY KEY (character_id, perk_id)
);

-- A moodlet of the same kind refreshes rather than stacks.
CREATE TABLE moodlets (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  moodlet_id    text NOT NULL,
  strength      int NOT NULL,
  expires_at    timestamptz NOT NULL,
  source        text NOT NULL,
  PRIMARY KEY (character_id, moodlet_id)
);

CREATE TABLE ambition_claims (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ambition_id   text NOT NULL,
  milestone     double precision NOT NULL,
  stars         int NOT NULL,
  claimed_at    timestamptz NOT NULL,
  PRIMARY KEY (character_id, ambition_id, milestone)
);

ALTER TABLE characters ADD COLUMN ambition_changed_at timestamptz;
