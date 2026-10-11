-- Milestone 4 · Friendly table games and the weekly City Mayor race (spec ch. 22, 25).
-- Rows that name another character avoid foreign keys to characters where a write could lock that
-- character's row while they hold it (opponents, reserved rematch seats, election winners).

CREATE TABLE game_tables (
  id             uuid PRIMARY KEY,
  game           text NOT NULL CHECK (game IN ('four_in_row')),
  mode           text NOT NULL CHECK (mode IN ('friendly', 'practice')),
  venue          text NOT NULL,
  status         text NOT NULL CHECK (status IN ('open', 'active', 'finished', 'cancelled')),
  seat_a         uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  seat_b         uuid REFERENCES characters(id) ON DELETE CASCADE,
  reserved_for   uuid,
  board          text NOT NULL CHECK (length(board) = 42),
  turn           text NOT NULL CHECK (turn IN ('a', 'b')),
  version        int NOT NULL DEFAULT 0,
  moves          jsonb NOT NULL DEFAULT '[]',
  misses_a       int NOT NULL DEFAULT 0,
  misses_b       int NOT NULL DEFAULT 0,
  turn_deadline  timestamptz,
  open_until     timestamptz,
  winner         text CHECK (winner IN ('a', 'b', 'draw')),
  end_reason     text,
  win_line       jsonb,
  rematch_of     uuid REFERENCES game_tables(id) ON DELETE SET NULL,
  rematch_id     uuid,
  created_at     timestamptz NOT NULL,
  started_at     timestamptz,
  finished_at    timestamptz
);
CREATE INDEX game_tables_by_status ON game_tables (status, mode, created_at DESC);
CREATE INDEX game_tables_seat_a ON game_tables (seat_a, status);
CREATE INDEX game_tables_seat_b ON game_tables (seat_b, status);
-- One rematch per finished game, even if both players ask at once.
CREATE UNIQUE INDEX game_tables_one_rematch ON game_tables (rematch_of) WHERE rematch_of IS NOT NULL;

CREATE TABLE game_results (
  table_id       uuid NOT NULL REFERENCES game_tables(id) ON DELETE CASCADE,
  character_id   uuid NOT NULL,
  game           text NOT NULL,
  outcome        text NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  reason         text NOT NULL,
  opponent_name  text NOT NULL,
  finished_at    timestamptz NOT NULL,
  PRIMARY KEY (table_id, character_id)
);
CREATE INDEX game_results_by_character ON game_results (character_id, finished_at DESC);

CREATE TABLE election_candidates (
  race_key      text NOT NULL,
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name          text NOT NULL,
  policy_id     text NOT NULL,
  stood_at      timestamptz NOT NULL,
  PRIMARY KEY (race_key, character_id)
);

-- One final ballot per character per race.
CREATE TABLE election_ballots (
  race_key      text NOT NULL,
  voter_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  candidate_id  uuid NOT NULL,
  cast_at       timestamptz NOT NULL,
  PRIMARY KEY (race_key, voter_id),
  FOREIGN KEY (race_key, candidate_id) REFERENCES election_candidates (race_key, character_id) ON DELETE CASCADE
);

-- A counted race and the term it starts. A caretaker term has no winner_id.
CREATE TABLE civic_terms (
  race_key      text PRIMARY KEY,
  policy_id     text NOT NULL,
  winner_id     uuid,
  winner_name   text NOT NULL,
  votes         int NOT NULL,
  total_votes   int NOT NULL,
  candidates    int NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  certified_at  timestamptz NOT NULL,
  FOREIGN KEY (race_key, winner_id) REFERENCES election_candidates (race_key, character_id) ON DELETE CASCADE
);
