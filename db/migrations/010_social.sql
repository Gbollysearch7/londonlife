-- Milestone 3 · Shared life between real players: presence, friends, messages, gifts, visits,
-- moderation reports, rankings and the city feed (spec ch. 19, 27, 35.4).
-- Pairs are stored once with the smaller character id first (a_id < b_id).

-- Presence and privacy. A missing row means "never seen" and the default settings.
CREATE TABLE social_profiles (
  character_id    uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  last_active_at  timestamptz,
  share_feed      boolean NOT NULL DEFAULT true,
  read_receipts   boolean NOT NULL DEFAULT true
);
CREATE INDEX social_profiles_active ON social_profiles (last_active_at DESC);

CREATE TABLE friend_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_id        uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired', 'blocked')),
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  resolved_at  timestamptz,
  CHECK (from_id <> to_id)
);
-- At most one pending request between two people, whichever way round.
CREATE UNIQUE INDEX friend_requests_one_pending ON friend_requests (LEAST(from_id, to_id), GREATEST(from_id, to_id)) WHERE status = 'pending';
CREATE INDEX friend_requests_to ON friend_requests (to_id, status);
CREATE INDEX friend_requests_from ON friend_requests (from_id, created_at DESC);

CREATE TABLE friendships (
  a_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  b_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  points   int NOT NULL DEFAULT 0 CHECK (points >= 0),
  since    timestamptz NOT NULL,
  PRIMARY KEY (a_id, b_id),
  CHECK (a_id < b_id)
);
CREATE INDEX friendships_b ON friendships (b_id);

-- One row per pair per London day: who interacted, and how many points that day has paid so far.
CREATE TABLE friendship_days (
  a_id            uuid NOT NULL,
  b_id            uuid NOT NULL,
  day             text NOT NULL,
  a_active        boolean NOT NULL DEFAULT false,
  b_active        boolean NOT NULL DEFAULT false,
  gift            boolean NOT NULL DEFAULT false,
  visit           boolean NOT NULL DEFAULT false,
  points_awarded  int NOT NULL DEFAULT 0,
  PRIMARY KEY (a_id, b_id, day),
  FOREIGN KEY (a_id, b_id) REFERENCES friendships(a_id, b_id) ON DELETE CASCADE
);

CREATE TABLE blocks (
  blocker_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked ON blocks (blocked_id);

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id             uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  b_id             uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL,
  last_message_at  timestamptz,
  UNIQUE (a_id, b_id),
  CHECK (a_id < b_id)
);

-- Ordered by id. client_id makes a retried send land once.
CREATE TABLE messages (
  id               bigserial PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  client_id        text NOT NULL,
  kind             text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'gift', 'money_request', 'system')),
  body             text NOT NULL,
  ref_id           uuid,
  created_at       timestamptz NOT NULL,
  UNIQUE (sender_id, client_id)
);
CREATE INDEX messages_by_conversation ON messages (conversation_id, id);

CREATE TABLE conversation_reads (
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  character_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  last_read_id     bigint NOT NULL DEFAULT 0,
  read_at          timestamptz,
  PRIMARY KEY (conversation_id, character_id)
);

-- Gifts complete at once; money requests wait for the payer. payer_id always loses the money.
CREATE TABLE money_transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('gift', 'request')),
  payer_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  payee_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  amount_pence  bigint NOT NULL CHECK (amount_pence > 0),
  note          text NOT NULL DEFAULT '',
  status        text NOT NULL CHECK (status IN ('completed', 'pending', 'declined', 'cancelled', 'expired')),
  client_id     text NOT NULL,
  period_key    text NOT NULL,
  created_at    timestamptz NOT NULL,
  expires_at    timestamptz,
  resolved_at   timestamptz,
  UNIQUE (created_by, client_id),
  CHECK (payer_id <> payee_id)
);
CREATE INDEX money_transfers_payer ON money_transfers (payer_id, status);
CREATE INDEX money_transfers_payee ON money_transfers (payee_id, status);

CREATE TABLE home_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  host_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  ended_at    timestamptz,
  CHECK (guest_id <> host_id)
);
-- One open visit per guest.
CREATE UNIQUE INDEX home_visits_one_open ON home_visits (guest_id) WHERE ended_at IS NULL;
CREATE INDEX home_visits_host ON home_visits (host_id) WHERE ended_at IS NULL;

-- Moderation: what was reported, with the context needed to review it.
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  note         text NOT NULL DEFAULT '',
  context      jsonb NOT NULL,
  period_key   text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz NOT NULL,
  UNIQUE (reporter_id, target_id, period_key),
  CHECK (reporter_id <> target_id)
);

CREATE INDEX game_events_feed ON game_events (id DESC) WHERE type IN ('promoted', 'story_completed', 'treasure_found', 'moved_home', 'home_bought', 'certified');
