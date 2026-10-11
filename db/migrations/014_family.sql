-- Milestone 3 · Relationships, households and invitations between real players (spec ch. 19).
-- Romance and households both need the other player's own acceptance; nothing here can be
-- created by the sender's button alone. Ending a friendship (unfriend or block) ends every tie
-- in this file between the two people.

-- A romance between two friends, stored once per pair (a_id < b_id). One romance per person at a time.
-- value = friendship points gained since it began (shared days) + bonus (shared parties), capped in content.
CREATE TABLE romances (
  a_id          uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  b_id          uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('dating', 'partnered')),
  base_points   int NOT NULL DEFAULT 0,
  bonus         int NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  started_at    timestamptz NOT NULL,
  partnered_at  timestamptz,
  PRIMARY KEY (a_id, b_id),
  CHECK (a_id < b_id)
);
CREATE INDEX romances_b ON romances (b_id);

-- "Will you date me?" / "Will you be my partner?": pending until the person asked answers.
CREATE TABLE romance_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_id        uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('date', 'partner')),
  -- pending | accepted | declined | withdrawn | expired | cancelled
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  resolved_at  timestamptz,
  CHECK (from_id <> to_id)
);
CREATE UNIQUE INDEX romance_requests_one_pending ON romance_requests (from_id, to_id, kind) WHERE status = 'pending';
CREATE INDEX romance_requests_to ON romance_requests (to_id) WHERE status = 'pending';

-- Household membership: the member may use the owner's home appliances with their own groceries.
-- A person is a member of at most one household (the primary key).
CREATE TABLE household_members (
  member_id  uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  owner_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL,
  CHECK (member_id <> owner_id)
);
CREATE INDEX household_members_owner ON household_members (owner_id);

-- A real-player house party, opened by the host after starting a house party at home.
CREATE TABLE player_parties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  day_key      text NOT NULL,
  started_at   timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  ended_at     timestamptz,
  capacity     int NOT NULL CHECK (capacity > 0),
  -- Slots reserved so far; incremented atomically and never above capacity.
  guest_count  int NOT NULL DEFAULT 0,
  UNIQUE (host_id, day_key),
  CHECK (guest_count BETWEEN 0 AND capacity)
);

-- One row per guest per party: the reward is paid exactly once, when the row is first written.
CREATE TABLE party_guests (
  party_id   uuid NOT NULL REFERENCES player_parties(id) ON DELETE CASCADE,
  guest_id   uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL,
  PRIMARY KEY (party_id, guest_id)
);

-- Invitations from a host to a friend: to visit, to join the household, or to a party.
CREATE TABLE invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('visit', 'household', 'party')),
  host_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  guest_id     uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  party_id     uuid REFERENCES player_parties(id) ON DELETE CASCADE,
  -- The visit an accepted visit invitation started (ended if the host revokes it).
  visit_id     uuid REFERENCES home_visits(id) ON DELETE SET NULL,
  -- pending | accepted | declined | revoked | expired
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  resolved_at  timestamptz,
  CHECK (host_id <> guest_id),
  CHECK ((kind = 'party') = (party_id IS NOT NULL))
);
CREATE UNIQUE INDEX invitations_one_pending ON invitations (host_id, guest_id, kind) WHERE status = 'pending';
CREATE UNIQUE INDEX invitations_one_per_party ON invitations (party_id, guest_id) WHERE party_id IS NOT NULL AND status IN ('pending', 'accepted');
CREATE INDEX invitations_guest ON invitations (guest_id, status);

-- Activities a household member ran with the owner's appliances (an audit of whose home was used).
CREATE TABLE host_home_uses (
  activity_id  uuid PRIMARY KEY,
  member_id    uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  host_id      uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL
);
