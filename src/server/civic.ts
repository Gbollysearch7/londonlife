import { ELECTION, PLATFORMS, POLICIES, pickWinner, policyDef, previousRaceKey, raceClose, raceKeyAt, type PolicyId } from "@/content/civic";
import { venue } from "@/content/world";
import { GameError, type Tx } from "./db";
import { emit, requireCharacter, settle, type CharRow } from "./game";

/**
 * Weekly City Mayor race (spec ch. 25). Ballots belong to the race open when the server receives them,
 * so a ballot after Sunday 20:00 London counts in next week's race. Each race is counted once, lazily,
 * by whoever first needs the result; the count is deterministic, so a concurrent count gives the same answer.
 */

const lockRace = (tx: Tx, key: string) => tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`civic:${key}`]);

/** Counts a closed race once and records the term it starts. Returns the term row. */
export async function certifyRace(tx: Tx, key: string, now: Date) {
  const existing = (await tx.query("SELECT * FROM civic_terms WHERE race_key = $1", [key])).rows[0];
  if (existing) return existing;
  await lockRace(tx, key);
  const again = (await tx.query("SELECT * FROM civic_terms WHERE race_key = $1", [key])).rows[0];
  if (again) return again;
  const rows = (
    await tx.query(
      `SELECT c.character_id, c.name, c.policy_id, c.stood_at, COUNT(b.voter_id)::int AS votes
       FROM election_candidates c LEFT JOIN election_ballots b ON b.race_key = c.race_key AND b.candidate_id = c.character_id
       WHERE c.race_key = $1 GROUP BY c.character_id, c.name, c.policy_id, c.stood_at`,
      [key],
    )
  ).rows;
  const total = rows.reduce((n, r) => n + Number(r.votes), 0);
  const win = pickWinner(rows.map((r) => ({ candidateId: r.character_id, votes: Number(r.votes), stoodAt: new Date(r.stood_at) })));
  const winner = win ? rows.find((r) => r.character_id === win.candidateId)! : null;
  const starts = raceClose(key);
  const ends = new Date(raceClose(raceKeyAt(starts)).getTime());
  const ins = await tx.query(
    `INSERT INTO civic_terms (race_key, policy_id, winner_id, winner_name, votes, total_votes, candidates, starts_at, ends_at, certified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (race_key) DO NOTHING RETURNING *`,
    [key, winner?.policy_id ?? "status_quo", winner?.character_id ?? null, winner?.name ?? ELECTION.caretaker, winner ? Number(winner.votes) : 0, total, rows.length, starts, ends, now],
  );
  return ins.rows[0] ?? (await tx.query("SELECT * FROM civic_terms WHERE race_key = $1", [key])).rows[0];
}

/** The policy in force at `now`: the winner of the race that most recently closed. */
export async function currentPolicy(tx: Tx, now: Date): Promise<PolicyId> {
  const term = await certifyRace(tx, previousRaceKey(now), now);
  return policyDef(term.policy_id).id;
}

function eligibility(c: CharRow, now: Date): string | null {
  const ageMs = now.getTime() - new Date(c.created_at).getTime();
  if (ageMs < ELECTION.minAgeHours * 3_600_000) return `You can stand and vote once you've been in London for ${ELECTION.minAgeHours} hours.`;
  return null;
}

/** Ballots are cast at City Hall when this build has one; otherwise from the Government app anywhere. */
function pollingBlocker(c: CharRow): string | null {
  const hall = venue(ELECTION.pollingVenue);
  if (hall && c.location !== hall.id) return `Votes are cast in person at ${hall.name}.`;
  return null;
}

export async function standForElection(tx: Tx, accountId: string, p: { policyId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const why = eligibility(c, now);
  if (why) throw new GameError("too_new", why);
  const policy = PLATFORMS.find((x) => x.id === p.policyId);
  if (!policy) throw new GameError("bad_policy", "Choose one of the listed policies.");
  const key = raceKeyAt(now);
  await lockRace(tx, key);
  if ((await tx.query("SELECT 1 FROM civic_terms WHERE race_key = $1", [key])).rowCount) throw new GameError("closed", "That race has closed.");
  const ins = await tx.query(
    "INSERT INTO election_candidates (race_key, character_id, name, policy_id, stood_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [key, c.id, c.name, policy.id, now],
  );
  if (!ins.rowCount) throw new GameError("already_standing", "You're already standing in this week's race.");
  await emit(tx, c.id, "stood_for_office", { policy: policy.id }, now);
  return { message: `You're standing for ${ELECTION.office} on “${policy.name}”. Voting closes Sunday at 20:00.` };
}

export async function castVote(tx: Tx, accountId: string, p: { candidateId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const why = eligibility(c, now) ?? pollingBlocker(c);
  if (why) throw new GameError("cannot_vote", why);
  // In person means actually there: someone who has set off elsewhere can't vote from the journey.
  const moving = await tx.query("SELECT 1 FROM journeys WHERE character_id = $1 AND status = 'in_transit'", [c.id]);
  if (moving.rowCount && venue(ELECTION.pollingVenue)) throw new GameError("cannot_vote", "You're on your way somewhere. Votes are cast in person.");
  const key = raceKeyAt(now);
  await lockRace(tx, key);
  if ((await tx.query("SELECT 1 FROM civic_terms WHERE race_key = $1", [key])).rowCount) throw new GameError("closed", "That race has closed.");
  const id = typeof p.candidateId === "string" && /^[0-9a-f-]{36}$/i.test(p.candidateId) ? p.candidateId : null;
  const cand = id ? (await tx.query("SELECT * FROM election_candidates WHERE race_key = $1 AND character_id = $2", [key, id])).rows[0] : null;
  if (!cand) throw new GameError("bad_candidate", "That person isn't standing in this week's race.");
  const ins = await tx.query("INSERT INTO election_ballots (race_key, voter_id, candidate_id, cast_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [key, c.id, cand.character_id, now]);
  if (!ins.rowCount) throw new GameError("already_voted", "You've already voted this week. Ballots are final.");
  await emit(tx, c.id, "voted", {}, now);
  return { message: `Ballot cast for ${cand.name} (${policyDef(cand.policy_id).name}). Results at 20:00 on Sunday.` };
}

/** Government app state. Vote counts are public; who voted for whom never is (only your own ballot). */
export async function civicView(tx: Tx, c: CharRow, now: Date) {
  const key = raceKeyAt(now);
  const current = await certifyRace(tx, previousRaceKey(now), now);
  // Older races nobody looked at since they closed are still counted, so the history is complete.
  const uncounted = await tx.query(
    "SELECT DISTINCT race_key FROM election_candidates WHERE race_key < $1 AND race_key NOT IN (SELECT race_key FROM civic_terms) ORDER BY race_key",
    [current.race_key],
  );
  for (const r of uncounted.rows) await certifyRace(tx, r.race_key, now);
  const cands = (
    await tx.query(
      `SELECT c.character_id, c.name, c.policy_id, c.stood_at, COUNT(b.voter_id)::int AS votes
       FROM election_candidates c LEFT JOIN election_ballots b ON b.race_key = c.race_key AND b.candidate_id = c.character_id
       WHERE c.race_key = $1 GROUP BY c.character_id, c.name, c.policy_id, c.stood_at ORDER BY c.stood_at, c.character_id`,
      [key],
    )
  ).rows;
  const ballot = (await tx.query("SELECT candidate_id FROM election_ballots WHERE race_key = $1 AND voter_id = $2", [key, c.id])).rows[0];
  const past = (await tx.query("SELECT * FROM civic_terms ORDER BY race_key DESC LIMIT 6")).rows;
  const hall = venue(ELECTION.pollingVenue);
  const term = (r: Record<string, unknown>) => ({
    raceKey: String(r.race_key),
    policy: policyDef(String(r.policy_id)),
    mayor: String(r.winner_name),
    caretaker: !r.winner_id,
    you: r.winner_id === c.id,
    votes: Number(r.votes),
    totalVotes: Number(r.total_votes),
    candidates: Number(r.candidates),
    startsAt: new Date(r.starts_at as string).toISOString(),
    endsAt: new Date(r.ends_at as string).toISOString(),
  });
  return {
    civic: {
      office: ELECTION.office,
      raceKey: key,
      closesAt: raceClose(key).toISOString(),
      eligibleReason: eligibility(c, now),
      pollingPlace: hall ? hall.name : null,
      voteBlocker: eligibility(c, now) ?? pollingBlocker(c),
      platforms: PLATFORMS,
      policies: POLICIES,
      candidates: cands.map((r) => ({ id: String(r.character_id), name: String(r.name), policy: policyDef(r.policy_id), votes: Number(r.votes), you: r.character_id === c.id })),
      standing: cands.some((r) => r.character_id === c.id),
      myBallot: ballot ? String(ballot.candidate_id) : null,
      current: term(current),
      past: past.map(term),
    },
  };
}
