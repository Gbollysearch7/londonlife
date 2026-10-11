-- Milestone 2 · Fictional health conditions and food delivery (spec ch. 7.3, 13).

ALTER TABLE characters ADD COLUMN condition text;
ALTER TABLE characters ADD COLUMN condition_since timestamptz;

CREATE TABLE deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  menu_id       text NOT NULL,
  items         jsonb NOT NULL,
  total_pence   bigint NOT NULL,
  status        text NOT NULL CHECK (status IN ('pending', 'delivered')),
  ordered_at    timestamptz NOT NULL,
  deliver_at    timestamptz NOT NULL,
  delivered_at  timestamptz
);
CREATE INDEX deliveries_pending ON deliveries (character_id) WHERE status = 'pending';
