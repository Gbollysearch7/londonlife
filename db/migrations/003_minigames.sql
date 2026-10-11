-- Milestone 2 · Minigames: quiz and rhythm runs tied to an activity (spec ch. 10, 30).

CREATE TABLE minigame_runs (
  id            uuid PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  activity_id   uuid NOT NULL UNIQUE REFERENCES activities(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('quiz', 'rhythm')),
  def_id        text NOT NULL,
  seed          text NOT NULL,
  status        text NOT NULL CHECK (status IN ('open', 'submitted', 'expired', 'cancelled')),
  started_at    timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  submitted_at  timestamptz,
  score         double precision,
  result        jsonb
);
CREATE INDEX minigame_runs_by_character ON minigame_runs (character_id, started_at DESC);
