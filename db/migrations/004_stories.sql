-- Milestone 2 · Branching stories and the daily city treasure (spec ch. 21).

CREATE TABLE story_runs (
  id            uuid PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  story_id      text NOT NULL,
  node_id       text NOT NULL,
  status        text NOT NULL CHECK (status IN ('running', 'completed', 'abandoned')),
  log           jsonb NOT NULL DEFAULT '[]',
  started_at    timestamptz NOT NULL,
  completed_at  timestamptz,
  ending        text
);
CREATE UNIQUE INDEX one_active_story ON story_runs (character_id) WHERE status = 'running';
CREATE INDEX story_runs_by_character ON story_runs (character_id, story_id);

-- Endings pay once per story per character, however many times it is replayed.
CREATE TABLE story_rewards (
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  story_id      text NOT NULL,
  ending        text NOT NULL,
  granted_at    timestamptz NOT NULL,
  PRIMARY KEY (character_id, story_id)
);

CREATE TABLE treasure_days (
  day     text PRIMARY KEY,
  claims  int NOT NULL DEFAULT 0
);

CREATE TABLE treasure_claims (
  day           text NOT NULL REFERENCES treasure_days(day),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  rank          int NOT NULL,
  reward_pence  bigint NOT NULL,
  claimed_at    timestamptz NOT NULL,
  PRIMARY KEY (day, character_id),
  UNIQUE (day, rank)
);
