import crypto from "node:crypto";
import { FOUR_IN_ROW, MISSES_TO_FORFEIT, OPEN_TABLE_MINUTES, PRACTICE_NPC, TURN_SECONDS, other, type Seat } from "@/content/fourInRow";
import { QUIET_MOVES_EACH, quietRun } from "@/content/draughts";
import { TABLE_GAME_LIST, draughtsHints, tableGame, type MoveRecord, type TableGame } from "@/content/tableGames";
import { hourLabel, isOpenAt, venue } from "@/content/world";
import { londonHour } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { emit, requireCharacter, settle, type CharRow } from "./game";
import { recordLadder } from "./ladder";

/**
 * Server-authoritative table games (spec ch. 22). Friendly only: no stakes, no payouts.
 * Every move is validated against the seat, the turn, the state version and the deadline.
 * Timeouts are settled lazily from the stored deadline, so the result never depends on who looks first.
 * Each game's rules (Four in a Row, Draughts) plug in through the registry in src/content/tableGames.ts.
 */

/** Venues with a games table. Extra venues are used only if they exist in this build. */
export const TABLE_VENUES = ["last_stop_pub", "chalk_and_cushion"];
const tableVenues = () => TABLE_VENUES.filter((id) => venue(id));

const TURN_MS = TURN_SECONDS * 1000;
const OPEN_MS = OPEN_TABLE_MINUTES * 60_000;

interface TableRow {
  id: string;
  game: string;
  mode: "friendly" | "practice";
  venue: string;
  status: "open" | "active" | "finished" | "cancelled";
  seat_a: string;
  seat_b: string | null;
  reserved_for: string | null;
  board: string;
  turn: Seat;
  version: number;
  moves: MoveRecord[];
  misses_a: number;
  misses_b: number;
  turn_deadline: Date | null;
  open_until: Date | null;
  winner: Seat | "draw" | null;
  end_reason: string | null;
  win_line: number[] | null;
  rematch_of: string | null;
  rematch_id: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

/** The rules of the game on a table. */
const rulesOf = (t: Pick<TableRow, "game">): TableGame => {
  const g = tableGame(t.game);
  if (!g) throw new GameError("bad_game", "That game isn't available yet.");
  return g;
};

const seatOf = (t: TableRow, charId: string): Seat | null => (t.seat_a === charId ? "a" : t.seat_b === charId ? "b" : null);

async function lockTable(tx: Tx, id: unknown): Promise<TableRow> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new GameError("no_table", "That table doesn't exist.");
  const r = (await tx.query("SELECT * FROM game_tables WHERE id = $1 FOR UPDATE", [id])).rows[0];
  if (!r) throw new GameError("no_table", "That table doesn't exist.");
  return r as TableRow;
}

async function save(tx: Tx, t: TableRow) {
  await tx.query(
    `UPDATE game_tables SET status=$2, seat_b=$3, board=$4, turn=$5, version=$6, moves=$7, misses_a=$8, misses_b=$9, turn_deadline=$10,
       winner=$11, end_reason=$12, win_line=$13, started_at=$14, finished_at=$15, rematch_id=$16 WHERE id=$1`,
    [t.id, t.status, t.seat_b, t.board, t.turn, t.version, JSON.stringify(t.moves), t.misses_a, t.misses_b, t.turn_deadline, t.winner, t.end_reason, JSON.stringify(t.win_line ?? null), t.started_at, t.finished_at, t.rematch_id],
  );
}

async function names(tx: Tx, ids: (string | null)[]) {
  const list = ids.filter((x): x is string => !!x);
  if (!list.length) return {} as Record<string, string>;
  const r = await tx.query("SELECT id, name FROM characters WHERE id = ANY($1::uuid[])", [list]);
  return Object.fromEntries(r.rows.map((x) => [x.id, x.name])) as Record<string, string>;
}

/** Ends a game and records the result once (friendly games only go on the record). */
async function finish(tx: Tx, t: TableRow, winner: Seat | "draw", reason: string, line: number[] | null, at: Date) {
  t.status = "finished";
  t.winner = winner;
  t.end_reason = reason;
  t.win_line = line;
  t.finished_at = at;
  t.turn_deadline = null;
  if (t.mode !== "friendly" || !t.seat_b) return;
  const n = await names(tx, [t.seat_a, t.seat_b]);
  for (const seat of ["a", "b"] as const) {
    const me = seat === "a" ? t.seat_a : t.seat_b;
    const them = seat === "a" ? t.seat_b : t.seat_a;
    const result = winner === "draw" ? "draw" : winner === seat ? "win" : "loss";
    await tx.query(
      `INSERT INTO game_results (table_id, character_id, game, outcome, reason, opponent_name, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [t.id, me, t.game, result, reason, n[them] ?? "Someone", at],
    );
  }
  await recordLadder(tx, t, winner, n, at);
}

/** Applies one move for `seat`; finishes the game if it ends it. Caller has validated the move. */
async function applyMove(tx: Tx, t: TableRow, seat: Seat, move: unknown, at: Date, auto = false) {
  const g = rulesOf(t);
  const r = g.play(t.board, seat, move)!;
  t.board = r.board;
  t.moves = [...t.moves, auto ? { seat, ...r.record, auto: true } : { seat, ...r.record }];
  t.version += 1;
  t.turn = other(seat);
  t.turn_deadline = new Date(at.getTime() + TURN_MS);
  const end = g.end(t.board, t.turn, t.moves);
  if (end) await finish(tx, t, end.winner, end.reason, end.line, at);
}

/** The practice opponent replies immediately. */
async function npcReply(tx: Tx, t: TableRow, at: Date) {
  if (t.mode !== "practice" || t.status !== "active" || t.turn !== "b") return;
  const m = rulesOf(t).aiMove(t.board, "b");
  if (m !== null) await applyMove(tx, t, "b", m, at);
}

/**
 * Brings a locked table up to `now`: expires an unjoined table, then works through missed turns in order.
 * A first miss plays the game's automatic move (Four in a Row: the most central column); a second miss in a row forfeits.
 */
async function settleTable(tx: Tx, t: TableRow, now: Date): Promise<boolean> {
  let changed = false;
  if (t.status === "open" && t.open_until && new Date(t.open_until) <= now) {
    t.status = "cancelled";
    t.end_reason = "expired";
    t.finished_at = new Date(t.open_until);
    changed = true;
  }
  while (t.status === "active" && t.turn_deadline && new Date(t.turn_deadline) <= now) {
    const at = new Date(t.turn_deadline);
    const seat = t.turn;
    const misses = (seat === "a" ? t.misses_a : t.misses_b) + 1;
    if (seat === "a") t.misses_a = misses;
    else t.misses_b = misses;
    changed = true;
    if (misses >= MISSES_TO_FORFEIT) {
      t.version += 1;
      await finish(tx, t, other(seat), "timeout", null, at);
      break;
    }
    const auto = rulesOf(t).autoMove(t.board, seat);
    if (auto === null) break;
    await applyMove(tx, t, seat, auto, at, true);
    await npcReply(tx, t, at);
  }
  if (changed) await save(tx, t);
  return changed;
}

/** Settles any of this character's unfinished tables, then says whether one is still open or active. */
async function busyAt(tx: Tx, c: CharRow, now: Date) {
  const mine = await tx.query(
    "SELECT * FROM game_tables WHERE (seat_a = $1 OR seat_b = $1) AND status IN ('open','active') ORDER BY id FOR UPDATE",
    [c.id],
  );
  let busy: TableRow | null = null;
  for (const row of mine.rows as TableRow[]) {
    await settleTable(tx, row, now);
    if (row.status === "open" || row.status === "active") busy = row;
  }
  return busy;
}

async function requireAtTableVenue(tx: Tx, c: CharRow, venueId: string, now: Date) {
  const v = venue(venueId);
  if (!v || c.location !== venueId) throw new GameError("wrong_place", `Games tables are at ${venue(venueId)?.name ?? "the pub"}. Go there to play.`);
  const travelling = (await tx.query("SELECT 1 FROM journeys WHERE character_id = $1 AND status = 'in_transit'", [c.id])).rowCount;
  if (travelling) throw new GameError("travelling", "You're travelling.");
  if (!isOpenAt(v, londonHour(now))) throw new GameError("closed", `${v.name} is closed. Opens at ${hourLabel(v.hours![0])}.`);
}

function busyError(t: TableRow) {
  return new GameError("at_table", t.status === "open" ? "You already have a table waiting. Close it first." : "Finish your current game first.");
}

// ─────────────────────────── commands ───────────────────────────

export async function createGameTable(tx: Tx, accountId: string, p: { mode?: string; game?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const g = tableGame(p.game === undefined ? FOUR_IN_ROW.id : typeof p.game === "string" ? p.game : "");
  if (!g) throw new GameError("bad_game", "That game isn't available yet.");
  const mode = p.mode === "practice" ? "practice" : p.mode === "friendly" || p.mode === undefined ? "friendly" : null;
  if (!mode) throw new GameError("bad_mode", "Choose a friendly table or practice.");
  const busy = await busyAt(tx, c, now);
  if (busy) throw busyError(busy);
  const id = crypto.randomUUID();
  if (mode === "practice") {
    await tx.query(
      `INSERT INTO game_tables (id, game, mode, venue, status, seat_a, board, turn, turn_deadline, created_at, started_at)
       VALUES ($1,$2,'practice',$3,'active',$4,$5,'a',$6,$7,$7)`,
      [id, g.id, c.location, c.id, g.emptyBoard(), new Date(now.getTime() + TURN_MS), now],
    );
    return { message: `Practice ${g.name} started against ${PRACTICE_NPC.label}. You go first.`, tableId: id };
  }
  const where = tableVenues().includes(c.location) ? c.location : tableVenues()[0];
  await requireAtTableVenue(tx, c, where, now);
  await tx.query(
    `INSERT INTO game_tables (id, game, mode, venue, status, seat_a, board, turn, open_until, created_at)
     VALUES ($1,$2,'friendly',$3,'open',$4,$5,'a',$6,$7)`,
    [id, g.id, where, c.id, g.emptyBoard(), new Date(now.getTime() + OPEN_MS), now],
  );
  await emit(tx, c.id, "table_opened", { game: g.id }, now);
  return { message: `${g.name} table open at ${venue(where)!.name}. Waiting for someone to join.`, tableId: id };
}

export async function joinGameTable(tx: Tx, accountId: string, p: { tableId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const busy = await busyAt(tx, c, now);
  const t = await lockTable(tx, p.tableId);
  await settleTable(tx, t, now);
  if (t.seat_a === c.id) throw new GameError("own_table", "That's your table — wait for someone to join.");
  if (t.status !== "open" || t.seat_b) throw new GameError("table_full", t.status === "cancelled" ? "That table has closed." : "Someone else got that seat.");
  if (t.reserved_for && t.reserved_for !== c.id) throw new GameError("reserved", "That rematch is waiting for someone else.");
  if (busy) throw busyError(busy);
  // A rematch is accepted wherever the two of you are; a new table needs you at the venue.
  if (!t.rematch_of) await requireAtTableVenue(tx, c, t.venue, now);
  t.seat_b = c.id;
  t.status = "active";
  t.started_at = now;
  t.turn_deadline = new Date(now.getTime() + TURN_MS);
  t.version += 1;
  await save(tx, t);
  await emit(tx, c.id, "table_joined", { game: t.game }, now);
  const n = await names(tx, [t.seat_a]);
  return { message: `You sat down with ${n[t.seat_a] ?? "your opponent"}. ${seatOf(t, c.id) === t.turn ? "Your move." : "They go first."}`, tableId: t.id };
}

export async function gameMove(tx: Tx, accountId: string, p: { tableId: string; version: number; column?: number; path?: number[] }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const t = await lockTable(tx, p.tableId);
  await settleTable(tx, t, now);
  const seat = seatOf(t, c.id);
  if (!seat) throw new GameError("spectator", "You're watching this table — only the players can move.");
  if (t.status === "open") throw new GameError("not_started", "Waiting for an opponent to join.");
  if (t.status !== "active") throw new GameError("game_over", "That game has finished.");
  if (t.turn !== seat) throw new GameError("not_your_turn", "It's not your turn.");
  if (!Number.isInteger(p.version) || p.version !== t.version) throw new GameError("stale", "The board changed — here's the latest position.");
  const g = rulesOf(t);
  const move = g.parseMove(p as unknown as Record<string, unknown>);
  if (move === null || !g.play(t.board, seat, move)) throw new GameError("illegal_move", g.illegalText(t.board, seat, move));
  if (seat === "a") t.misses_a = 0;
  else t.misses_b = 0;
  await applyMove(tx, t, seat, move, now);
  await npcReply(tx, t, now);
  await save(tx, t);
  // Re-read: the move above may have ended the game.
  if ((t.status as TableRow["status"]) === "finished") {
    await emit(tx, c.id, "table_game_finished", { game: t.game, mode: t.mode }, now);
    const msg = t.winner === "draw" ? "It's a draw." : t.winner === seat ? (t.game === FOUR_IN_ROW.id ? "Four in a row — you win!" : "You win!") : t.mode === "practice" ? `${PRACTICE_NPC.name} wins this time.` : "They win this time.";
    return { message: msg, tableId: t.id };
  }
  return { message: "", tableId: t.id };
}

/** Closes your waiting table, or resigns a game in progress. */
export async function leaveGameTable(tx: Tx, accountId: string, p: { tableId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const t = await lockTable(tx, p.tableId);
  await settleTable(tx, t, now);
  const seat = seatOf(t, c.id);
  if (!seat) throw new GameError("spectator", "You're only watching — closing the board doesn't affect the game.");
  if (t.status === "open") {
    t.status = "cancelled";
    t.end_reason = "closed";
    t.finished_at = now;
    t.version += 1;
    await save(tx, t);
    return { message: "Table closed." };
  }
  if (t.status !== "active") throw new GameError("game_over", "That game has already finished.");
  t.version += 1;
  await finish(tx, t, other(seat), "resigned", null, now);
  await save(tx, t);
  return { message: "You resigned. Good game." };
}

/**
 * Rematch: the first player to ask opens a new table reserved for the other, who joins by asking too.
 * Whoever went second last time goes first. Practice rematches start straight away.
 */
export async function rematch(tx: Tx, accountId: string, p: { tableId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const busy = await busyAt(tx, c, now);
  const t = await lockTable(tx, p.tableId);
  const seat = seatOf(t, c.id);
  if (!seat) throw new GameError("spectator", "Only the players can ask for a rematch.");
  if (t.status !== "finished") throw new GameError("not_finished", "Finish this game first.");
  if (t.mode === "practice") {
    if (busy) throw busyError(busy);
    return createGameTable(tx, accountId, { mode: "practice", game: t.game }, now);
  }
  if (t.rematch_id) {
    const next = await lockTable(tx, t.rematch_id);
    if (next.seat_a === c.id) throw new GameError("asked", "Rematch offered — waiting for them to accept.");
    return joinGameTable(tx, accountId, { tableId: next.id }, now);
  }
  if (busy) throw busyError(busy);
  const opponent = seat === "a" ? t.seat_b! : t.seat_a;
  const id = crypto.randomUUID();
  await tx.query(
    `INSERT INTO game_tables (id, game, mode, venue, status, seat_a, reserved_for, board, turn, open_until, rematch_of, created_at)
     VALUES ($1,$2,'friendly',$3,'open',$4,$5,$6,$7,$8,$9,$10)`,
    // The new table's seat "a" is you; if you moved first last time, they move first now.
    [id, t.game, t.venue, c.id, opponent, rulesOf(t).emptyBoard(), seat === "a" ? "b" : "a", new Date(now.getTime() + OPEN_MS), t.id, now],
  );
  t.rematch_id = id;
  t.version += 1;
  await save(tx, t);
  return { message: "Rematch offered. It starts when they accept.", tableId: id };
}

// ─────────────────────────── views ───────────────────────────

/** Public state of one table: anyone may watch. These games have no hidden information. */
export async function tableView(tx: Tx, c: Pick<CharRow, "id">, tableId: unknown, now: Date) {
  const t = await lockTable(tx, tableId);
  await settleTable(tx, t, now);
  const n = await names(tx, [t.seat_a, t.seat_b, t.reserved_for]);
  const seat = seatOf(t, c.id);
  const player = (s: Seat) => {
    const id = s === "a" ? t.seat_a : t.seat_b;
    if (s === "b" && t.mode === "practice") return { seat: s, name: PRACTICE_NPC.label, npc: true, you: false, misses: 0 };
    return { seat: s, name: id ? n[id] ?? "Player" : t.reserved_for ? `Waiting for ${n[t.reserved_for] ?? "opponent"}` : "Open seat", npc: false, you: !!id && id === c.id, misses: s === "a" ? t.misses_a : t.misses_b };
  };
  const last = t.moves[t.moves.length - 1] ?? null;
  const g = rulesOf(t);
  return {
    id: t.id,
    game: t.game,
    gameName: g.name,
    rules: g.rules,
    /** Draughts: the legal paths for the player to move (public information), so the board can guide a tap. */
    hints: t.game === "draughts" && t.status === "active" ? draughtsHints(t.board, t.turn) : null,
    /** Draughts: moves in a row with no capture and no man moving, towards the draw rule. */
    quietMoves: t.game === "draughts" ? quietRun(t.moves as { progress?: boolean }[]) : null,
    quietLimit: t.game === "draughts" ? QUIET_MOVES_EACH * 2 : null,
    reasonLabel: t.end_reason ? g.reasonLabel[t.end_reason] ?? t.end_reason : null,
    mode: t.mode,
    venue: venue(t.venue)?.name ?? t.venue,
    status: t.status,
    board: t.board,
    turn: t.turn,
    version: t.version,
    players: [player("a"), player("b")],
    yourSeat: seat,
    spectating: !seat,
    yourTurn: t.status === "active" && seat === t.turn,
    turnDeadline: t.turn_deadline ? new Date(t.turn_deadline).toISOString() : null,
    openUntil: t.status === "open" && t.open_until ? new Date(t.open_until).toISOString() : null,
    lastMove: last,
    moveCount: t.moves.length,
    winner: t.winner,
    endReason: t.end_reason,
    winLine: t.win_line ?? null,
    reservedForYou: t.reserved_for === c.id && t.status === "open",
    rematchId: t.rematch_id,
    turnSeconds: TURN_SECONDS,
    now: now.toISOString(),
  };
}

export type TableView = Awaited<ReturnType<typeof tableView>>;

/** Read path for the board overlay's polling: no character lock, so watching never blocks anyone's commands. */
export async function loadTableFor(tx: Tx, accountId: string, tableId: unknown, now: Date) {
  const c = (await tx.query("SELECT id FROM characters WHERE account_id = $1", [accountId])).rows[0];
  if (!c) throw new GameError("no_character", "Create your character first.", 409);
  return tableView(tx, { id: c.id as string }, tableId, now);
}

/** Games app state: your table, open tables to join, live tables to watch, and your record. */
export async function gamesView(tx: Tx, c: CharRow, now: Date) {
  const busy = await busyAt(tx, c, now);
  // Lists show stored state; a stale open table drops out of the list by its own expiry time.
  const open = (
    await tx.query(
      `SELECT * FROM game_tables WHERE status = 'open' AND mode = 'friendly' AND open_until > $1 AND seat_a <> $2 AND (reserved_for IS NULL OR reserved_for = $2)
       ORDER BY created_at DESC LIMIT 12`,
      [now, c.id],
    )
  ).rows as TableRow[];
  const live = (
    await tx.query("SELECT * FROM game_tables WHERE status = 'active' AND mode = 'friendly' AND seat_a <> $1 AND seat_b <> $1 ORDER BY started_at DESC LIMIT 12", [c.id])
  ).rows as TableRow[];
  const n = await names(tx, [...open.map((t) => t.seat_a), ...live.flatMap((t) => [t.seat_a, t.seat_b])]);
  const rec = (await tx.query("SELECT outcome, COUNT(*)::int AS n FROM game_results WHERE character_id = $1 GROUP BY outcome", [c.id])).rows;
  const count = (o: string) => Number(rec.find((r) => r.outcome === o)?.n ?? 0);
  const recent = (await tx.query("SELECT * FROM game_results WHERE character_id = $1 ORDER BY finished_at DESC LIMIT 5", [c.id])).rows;
  const practiceWins = (await tx.query("SELECT COUNT(*)::int AS n FROM game_tables WHERE mode = 'practice' AND seat_a = $1 AND winner = 'a'", [c.id])).rows[0].n;
  const gameName = (id: string) => tableGame(id)?.name ?? id;
  return {
    games: {
      available: TABLE_GAME_LIST.map((g) => ({ id: g.id, name: g.name, blurb: g.blurb, rules: g.rules })),
      venues: tableVenues().map((id) => ({ id, name: venue(id)!.name, here: c.location === id })),
      mine: busy ? { id: busy.id, status: busy.status, mode: busy.mode, game: busy.game } : null,
      open: open.map((t) => ({ id: t.id, game: t.game, gameName: gameName(t.game), host: n[t.seat_a] ?? "Player", venue: venue(t.venue)?.name ?? t.venue, venueId: t.venue, rematch: !!t.reserved_for, here: c.location === t.venue })),
      live: live.map((t) => ({ id: t.id, game: t.game, gameName: gameName(t.game), players: [n[t.seat_a] ?? "Player", n[t.seat_b!] ?? "Player"], venue: venue(t.venue)?.name ?? t.venue, moves: (t.moves ?? []).length })),
      record: { wins: count("win"), losses: count("loss"), draws: count("draw"), practiceWins: Number(practiceWins) },
      recent: recent.map((r) => ({
        tableId: String(r.table_id),
        game: String(r.game),
        gameName: gameName(String(r.game)),
        outcome: String(r.outcome),
        reason: String(r.reason),
        reasonLabel: tableGame(String(r.game))?.reasonLabel[String(r.reason)] ?? String(r.reason),
        opponent: String(r.opponent_name),
        at: new Date(r.finished_at).toISOString(),
      })),
      here: await liveHere(tx, c),
    },
  };
}

/**
 * The game in progress at your current venue, for the 3D games table: a friendly game if there is one,
 * otherwise a practice game being played here. Public board state only.
 */
async function liveHere(tx: Tx, c: CharRow) {
  if (!tableVenues().includes(c.location)) return null;
  const t = (
    await tx.query(
      `SELECT * FROM game_tables WHERE venue = $1 AND status = 'active' ORDER BY (mode = 'friendly') DESC, started_at DESC LIMIT 1`,
      [c.location],
    )
  ).rows[0] as TableRow | undefined;
  if (!t) return null;
  const n = await names(tx, [t.seat_a, t.seat_b]);
  return {
    id: t.id,
    game: t.game,
    gameName: tableGame(t.game)?.name ?? t.game,
    board: t.board,
    turn: t.turn,
    mode: t.mode,
    players: [n[t.seat_a] ?? "Player", t.mode === "practice" ? PRACTICE_NPC.label : n[t.seat_b!] ?? "Player"],
    yours: t.seat_a === c.id || t.seat_b === c.id,
  };
}
