-- Milestone 2 · Careers and shifts (spec ch. 10).

CREATE TABLE career_progress (
  character_id     uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  career_id        text NOT NULL,
  rank             int NOT NULL CHECK (rank BETWEEN 1 AND 5),
  grade            int NOT NULL CHECK (grade BETWEEN 1 AND 3),
  performance      int NOT NULL CHECK (performance BETWEEN 0 AND 100),
  shifts_at_grade  int NOT NULL DEFAULT 0,
  joined_at        timestamptz NOT NULL
);

CREATE TABLE shifts (
  id               uuid PRIMARY KEY,
  character_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  career_id        text NOT NULL,
  rank             int NOT NULL,
  grade            int NOT NULL,
  salary_pence     bigint NOT NULL,          -- full-shift gross at the accepted grade (snapshot)
  location         text NOT NULL,
  status           text NOT NULL CHECK (status IN ('running', 'completed', 'left')),
  started_at       timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  settled_at       timestamptz,
  period_key       text NOT NULL,
  week_key         text NOT NULL,
  styles           jsonb NOT NULL,           -- [{ "style": "steady", "at": iso }]
  tasks            jsonb NOT NULL,           -- [{ "id", "dueAt", "expiresAt", "answer": null | index, "outcome": null | "success" | "ok" | "fail" }]
  gross_pence      bigint,
  tax_pence        bigint,
  net_pence        bigint,
  perf_delta       int,
  result           jsonb
);
CREATE UNIQUE INDEX one_running_shift ON shifts (character_id) WHERE status = 'running';
CREATE INDEX shifts_by_week ON shifts (character_id, week_key);
