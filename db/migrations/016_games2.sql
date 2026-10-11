-- Milestone 4 · More friendly games: Draughts on the shared table framework and a weekly ladder (spec ch. 22).
-- Friendly only: nothing here holds or moves money.

-- The table framework now hosts more than one game; each game keeps its own board size.
ALTER TABLE game_tables DROP CONSTRAINT IF EXISTS game_tables_game_check;
ALTER TABLE game_tables DROP CONSTRAINT IF EXISTS game_tables_board_check;
ALTER TABLE game_tables ADD CONSTRAINT game_tables_game_board CHECK (
  (game = 'four_in_row' AND length(board) = 42) OR (game = 'draughts' AND length(board) = 32)
);

-- One row per player per finished friendly game. `counted` is false when the game was too short or the
-- pair had already played their weekly allowance; such games stay on the record but score nothing.
-- No foreign keys to characters, so recording a result never locks either player's row.
CREATE TABLE game_ladder (
  table_id      uuid NOT NULL REFERENCES game_tables(id) ON DELETE CASCADE,
  character_id  uuid NOT NULL,
  opponent_id   uuid NOT NULL,
  name          text NOT NULL,
  week_key      text NOT NULL,
  venue         text NOT NULL,
  game          text NOT NULL,
  outcome       text NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  points        int NOT NULL CHECK (points >= 0),
  counted       boolean NOT NULL,
  note          text,
  finished_at   timestamptz NOT NULL,
  PRIMARY KEY (table_id, character_id)
);
CREATE INDEX game_ladder_board ON game_ladder (week_key, venue, character_id);
CREATE INDEX game_ladder_by_character ON game_ladder (character_id, week_key);
