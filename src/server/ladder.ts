import { LADDER, LADDER_RULES, ladderWeekKey, rankLadder, weekLabel, weeksBefore } from "@/content/ladder";
import { tableGame } from "@/content/tableGames";
import { londonInstant } from "@/sim/time";
import { venue } from "@/content/world";
import type { Tx } from "./db";
import type { CharRow } from "./game";
import { TABLE_VENUES } from "./tables";

/**
 * Weekly table-games ladder (spec ch. 22). Results are written once, inside the transaction that finishes
 * the game (primary key per table and player), so a replayed or concurrent finish can't score twice.
 * Practice games never reach here. Friendly only: no money moves.
 */

interface FinishedTable {
  id: string;
  game: string;
  mode: string;
  venue: string;
  seat_a: string;
  seat_b: string | null;
  moves: { seat: string; auto?: boolean }[];
}

const pairLock = (tx: Tx, week: string, x: string, y: string) =>
  tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`ladder:${week}:${[x, y].sort().join(":")}`]);

/** Records both players' ladder rows for a finished friendly game. Idempotent. */
export async function recordLadder(tx: Tx, t: FinishedTable, winner: "a" | "b" | "draw", names: Record<string, string>, at: Date) {
  if (t.mode !== "friendly" || !t.seat_b) return;
  const week = ladderWeekKey(at);
  await pairLock(tx, week, t.seat_a, t.seat_b);
  const own = (seat: string) => t.moves.filter((m) => m.seat === seat && !m.auto).length;
  const longEnough = own("a") >= LADDER.minOwnMoves && own("b") >= LADDER.minOwnMoves;
  const already = Number(
    (
      await tx.query("SELECT COUNT(*)::int AS n FROM game_ladder WHERE week_key = $1 AND character_id = $2 AND opponent_id = $3 AND counted AND table_id <> $4", [
        week,
        t.seat_a,
        t.seat_b,
        t.id,
      ])
    ).rows[0].n,
  );
  const withinPair = already < LADDER.pairGamesPerWeek;
  const counted = longEnough && withinPair;
  const note = !longEnough ? "too_short" : !withinPair ? "pair_limit" : null;
  for (const seat of ["a", "b"] as const) {
    const me = seat === "a" ? t.seat_a : t.seat_b;
    const them = seat === "a" ? t.seat_b : t.seat_a;
    const outcome = winner === "draw" ? "draw" : winner === seat ? "win" : "loss";
    await tx.query(
      `INSERT INTO game_ladder (table_id, character_id, opponent_id, name, week_key, venue, game, outcome, points, counted, note, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
      [t.id, me, them, names[me] ?? "Player", week, t.venue, t.game, outcome, counted ? LADDER.points[outcome] : 0, counted, note, at],
    );
  }
}

interface Standing {
  characterId: string;
  name: string;
  points: number;
  wins: number;
  draws: number;
  played: number;
  reachedAt: number;
}

/** Ranked standings for each (week, venue) asked for, from counted rows only. */
async function standings(tx: Tx, weeks: string[], venueIds?: string[]) {
  const rows = (
    await tx.query(
      `SELECT week_key, venue, character_id, MAX(name) AS name, SUM(points)::int AS points,
              COUNT(*) FILTER (WHERE outcome = 'win')::int AS wins, COUNT(*) FILTER (WHERE outcome = 'draw')::int AS draws,
              COUNT(*)::int AS played, MAX(finished_at) FILTER (WHERE points > 0) AS reached
       FROM game_ladder WHERE counted AND week_key = ANY($1::text[]) ${venueIds ? "AND venue = ANY($2::text[])" : ""}
       GROUP BY week_key, venue, character_id`,
      venueIds ? [weeks, venueIds] : [weeks],
    )
  ).rows;
  const out = new Map<string, Standing[]>();
  for (const r of rows) {
    const k = `${r.week_key}|${r.venue}`;
    const list = out.get(k) ?? [];
    list.push({
      characterId: String(r.character_id),
      name: String(r.name),
      points: Number(r.points),
      wins: Number(r.wins),
      draws: Number(r.draws),
      played: Number(r.played),
      reachedAt: r.reached ? new Date(r.reached).getTime() : Number.MAX_SAFE_INTEGER,
    });
    out.set(k, list);
  }
  for (const [k, list] of out) out.set(k, rankLadder(list));
  return out;
}

const champion = (list: Standing[] | undefined) => (list && list[0] && list[0].points > 0 ? list[0] : null);
const venueName = (id: string) => venue(id)?.name ?? id;

/** Ladder state for the Games app and the profile badge. */
export async function ladderView(tx: Tx, c: CharRow, now: Date) {
  const week = ladderWeekKey(now);
  const past = Array.from({ length: LADDER.pastWeeks }, (_, i) => weeksBefore(week, i + 1));
  // Venues with tables, plus any venue that saw ladder play in the window.
  const venues = TABLE_VENUES.filter((id) => venue(id));
  const all = await standings(tx, [week, ...past]);
  const seen = new Set<string>(venues);
  for (const k of all.keys()) seen.add(k.split("|")[1]);
  const venueIds = [...seen];

  const boards = venueIds
    .map((id) => {
      const list = all.get(`${week}|${id}`) ?? [];
      const mineAt = list.findIndex((s) => s.characterId === c.id);
      return {
        venueId: id,
        venue: venueName(id),
        here: c.location === id,
        top: list.slice(0, LADDER.boardSize).map((s, i) => ({ rank: i + 1, name: s.name, points: s.points, wins: s.wins, draws: s.draws, played: s.played, you: s.characterId === c.id })),
        you: mineAt >= 0 ? { rank: mineAt + 1, points: list[mineAt].points, played: list[mineAt].played } : null,
        players: list.length,
      };
    })
    .filter((b) => venues.includes(b.venueId) || b.players > 0);

  const hallOfFame = past.map((wk) => ({
    weekKey: wk,
    label: weekLabel(wk),
    champions: venueIds
      .map((id) => {
        const ch = champion(all.get(`${wk}|${id}`));
        return ch ? { venue: venueName(id), name: ch.name, points: ch.points, wins: ch.wins, you: ch.characterId === c.id } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x),
  }));

  // Badges: every finished week in which you topped a venue's board, most recent first.
  const myWeeks = (
    await tx.query("SELECT DISTINCT week_key, venue FROM game_ladder WHERE character_id = $1 AND counted AND points > 0 AND week_key < $2 ORDER BY week_key DESC LIMIT 30", [c.id, week])
  ).rows.map((r) => ({ week: String(r.week_key), venue: String(r.venue) }));
  const badgeStandings = myWeeks.length ? await standings(tx, [...new Set(myWeeks.map((w) => w.week))], [...new Set(myWeeks.map((w) => w.venue))]) : new Map<string, Standing[]>();
  const badges = myWeeks
    .filter((w) => champion(badgeStandings.get(`${w.week}|${w.venue}`))?.characterId === c.id)
    .map((w) => ({ weekKey: w.week, venue: venueName(w.venue), title: `${venueName(w.venue)} Table Champion`, label: weekLabel(w.week) }));

  // Your games this week and whether each counted.
  const recent = (
    await tx.query(
      `SELECT l.*, o.name AS opponent FROM game_ladder l LEFT JOIN game_ladder o ON o.table_id = l.table_id AND o.character_id = l.opponent_id
       WHERE l.character_id = $1 AND l.week_key = $2 ORDER BY l.finished_at DESC LIMIT 8`,
      [c.id, week],
    )
  ).rows.map((r) => ({
    tableId: String(r.table_id),
    game: tableGame(String(r.game))?.name ?? String(r.game),
    opponent: String(r.opponent ?? "Someone"),
    venue: venueName(String(r.venue)),
    outcome: String(r.outcome),
    points: Number(r.points),
    counted: !!r.counted,
    note: r.note === "too_short" ? `Too short to count (under ${LADDER.minOwnMoves} moves each)` : r.note === "pair_limit" ? `Already played them ${LADDER.pairGamesPerWeek} times this week` : null,
  }));

  return {
    ladder: {
      weekKey: week,
      weekLabel: weekLabel(week),
      endsAt: londonInstant(weeksBefore(week, -1), 0).toISOString(),
      rules: LADDER_RULES,
      boards,
      hallOfFame,
      badges,
      recent,
    },
  };
}
