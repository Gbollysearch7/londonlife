-- Minigame rounds record when play actually began, so questions stay hidden until then
-- and time limits are enforced on the server.
ALTER TABLE minigame_runs ADD COLUMN begun_at timestamptz;
