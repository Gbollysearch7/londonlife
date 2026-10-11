import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { loadTableFor } from "@/server/commands";
import { sq } from "@/content/draughts";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, resetDb, state } from "./helpers";

// 14:00 London on Saturday 10 Oct 2026: The Last Stop (12:00–00:00) is open. Ladder week of Mon 5 Oct.
const T0 = new Date("2026-10-10T13:00:00Z");
const secs = (base: Date, s: number) => new Date(base.getTime() + s * 1000);
const S = (r: number, c: number) => sq(r, c);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

const at = (acc: string, place: string) => pool().query("UPDATE characters SET location = $2 WHERE account_id = $1", [acc, place]);
const view = (acc: string, id: string, t: Date) => loadTableFor(acc, id, t);
const rename = (acc: string, name: string) => pool().query("UPDATE characters SET name = $2 WHERE account_id = $1", [acc, name]);

async function players(n = 2, names = ["Ada", "Bea", "Cal", "Dev"]) {
  const accs: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = await makeAccount();
    await makeCharacter(a, T0);
    await rename(a, names[i]);
    await at(a, "last_stop_pub");
    accs.push(a);
  }
  return accs;
}

async function openGame(a: string, b: string, game: string, t = T0) {
  const r = await cmd(a, "CreateGameTable", { mode: "friendly", game }, t);
  const id = (r.receipt as { tableId: string }).tableId;
  await cmd(b, "JoinGameTable", { tableId: id }, t);
  return id;
}

async function step(acc: string, id: string, path: number[], t: Date) {
  const v = await view(acc, id, t);
  return cmd(acc, "GameMove", { tableId: id, path, version: v.version }, t);
}

async function drop(acc: string, id: string, column: number, t: Date) {
  const v = await view(acc, id, t);
  return cmd(acc, "GameMove", { tableId: id, column, version: v.version }, t);
}

/** Puts a table into a chosen draughts position (test set-up only), keeping its version. */
const setBoard = (id: string, board: string, moves?: unknown[]) =>
  moves
    ? pool().query("UPDATE game_tables SET board = $2, moves = $3 WHERE id = $1", [id, board, JSON.stringify(moves)])
    : pool().query("UPDATE game_tables SET board = $2 WHERE id = $1", [id, board]);

function board(pieces: Record<string, string>) {
  const b = ".".repeat(32).split("");
  for (const [k, v] of Object.entries(pieces)) {
    const [r, c] = k.split(",").map(Number);
    b[sq(r, c)] = v;
  }
  return b.join("");
}

/** Three opening moves each that never capture: dark advances on the left, light on the right. */
const OPENING: [0 | 1, number[]][] = [
  [0, [S(2, 0), S(3, 1)]],
  [1, [S(5, 7), S(4, 6)]],
  [0, [S(1, 1), S(2, 0)]],
  [1, [S(6, 6), S(5, 7)]],
  [0, [S(0, 0), S(1, 1)]],
  [1, [S(7, 7), S(6, 6)]],
];

async function playOpening(a: string, b: string, id: string, from = T0) {
  let t = from;
  for (const [who, path] of OPENING) {
    t = secs(t, 2);
    await step(who === 0 ? a : b, id, path, t);
  }
  return t;
}

/** A quick legitimate Four in a Row win for `winner` (4 moves to 3). */
async function fourWin(winner: string, loser: string, t0: Date) {
  const id = await openGame(winner, loser, "four_in_row", t0);
  let t = t0;
  for (const [acc, col] of [[winner, 0], [loser, 1], [winner, 0], [loser, 1], [winner, 0], [loser, 1], [winner, 0]] as const) {
    t = secs(t, 2);
    await drop(acc, id, col, t);
  }
  return { id, t };
}

describe("Draughts · friendly tables", () => {
  it("opens, joins and plays on the shared table framework; the board is public and nothing is staked", async () => {
    const [a, b, watcher] = await players(3);
    const cash = (await state(a, T0)).wallet.cashPence;
    const id = await openGame(a, b, "draughts");
    const v0 = await view(watcher, id, T0);
    expect(v0).toMatchObject({ game: "draughts", gameName: "Draughts", status: "active", spectating: true, turn: "a" });
    expect(v0.board).toBe("a".repeat(12) + ".".repeat(8) + "b".repeat(12));
    expect(v0.hints).toHaveLength(7);
    expect(v0.rules.join(" ")).toMatch(/compulsory/);
    await step(a, id, [S(2, 2), S(3, 3)], secs(T0, 2));
    const v1 = await view(b, id, secs(T0, 3));
    expect(v1.lastMove).toMatchObject({ seat: "a", path: [S(2, 2), S(3, 3)], captured: [] });
    expect(v1.yourTurn).toBe(true);
    expect(v1.board[S(3, 3)]).toBe("a");
    expect((await state(a, secs(T0, 4))).wallet.cashPence).toBe(cash);
    expect(await ledgerMatches(a)).toBe(true);
  });

  it("validates every move: direction, turn, version, spectators and compulsory captures", async () => {
    const [a, b, c] = await players(3);
    const id = await openGame(a, b, "draughts");
    const v = await view(a, id, T0);
    const tryMove = (acc: string, path: unknown, version = v.version) => cmd(acc, "GameMove", { tableId: id, path, version }, T0);
    await expect(tryMove(a, [S(2, 2), S(4, 4)])).rejects.toThrow(/isn't legal/);
    await expect(tryMove(a, [S(2, 2), S(3, 2)])).rejects.toThrow(/isn't legal/);
    await expect(tryMove(a, [S(5, 1), S(4, 0)])).rejects.toThrow(/isn't legal/);
    await expect(tryMove(a, "8-12")).rejects.toThrow(/isn't legal/);
    await expect(tryMove(a, [99, 100])).rejects.toThrow(/isn't legal/);
    await expect(cmd(a, "GameMove", { tableId: id, column: 3, version: v.version }, T0)).rejects.toThrow(/isn't legal/);
    await expect(tryMove(b, [S(5, 1), S(4, 0)])).rejects.toThrow(/not your turn/);
    await expect(tryMove(c, [S(2, 2), S(3, 3)])).rejects.toThrow(/only the players/);
    await expect(tryMove(a, [S(2, 2), S(3, 3)], v.version - 1)).rejects.toThrow(/board changed/);
    // Set up a forced capture for dark, with a double jump available.
    await setBoard(id, board({ "0,0": "a", "1,1": "b", "3,3": "b", "2,6": "a", "7,7": "b" }));
    await expect(tryMove(a, [S(2, 6), S(3, 7)])).rejects.toThrow(/must take/);
    await expect(tryMove(a, [S(0, 0), S(2, 2)])).rejects.toThrow(/Keep jumping/);
    // Replaying the same request key applies once.
    const k = key();
    await cmd(a, "GameMove", { tableId: id, path: [S(0, 0), S(2, 2), S(4, 4)], version: v.version }, T0, k);
    expect((await cmd(a, "GameMove", { tableId: id, path: [S(0, 0), S(2, 2), S(4, 4)], version: v.version }, T0, k)).replayed).toBe(true);
    const after = await view(c, id, secs(T0, 1));
    expect(after.lastMove).toMatchObject({ captured: [S(1, 1), S(3, 3)] });
    expect(after.board[S(1, 1)]).toBe(".");
    expect(after.board[S(3, 3)]).toBe(".");
    expect(after.moveCount).toBe(1);
  });

  it("taking the last piece wins (no legal moves for the loser); the result is recorded once", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    let t = await playOpening(a, b, id);
    await setBoard(id, board({ "2,2": "a", "3,3": "b" }));
    t = secs(t, 2);
    const r = await step(a, id, [S(2, 2), S(4, 4)], t);
    expect((r.receipt as { message: string }).message).toMatch(/You win/);
    const v = await view(b, id, secs(t, 1));
    expect(v).toMatchObject({ status: "finished", winner: "a", endReason: "no_moves", reasonLabel: "no moves left" });
    await expect(step(b, id, [S(4, 4), S(3, 3)], secs(t, 2))).rejects.toThrow(/finished/);
    await expect(cmd(b, "LeaveGameTable", { tableId: id }, secs(t, 2))).rejects.toThrow(/already finished/);
    const results = await pool().query("SELECT character_id, outcome FROM game_results WHERE table_id = $1", [id]);
    expect(results.rows).toHaveLength(2);
    const sb = await state(b, secs(t, 3));
    expect(sb.games.recent[0]).toMatchObject({ outcome: "loss", reason: "no_moves", gameName: "Draughts", reasonLabel: "no moves left" });
  });

  it("a blocked-in side loses even with pieces left", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    // Light's only man on (1,1) can't step onto (0,0)/(0,2) or jump off the board; dark's men behind
    // it on (2,0)/(2,2) leave dark nothing to capture either. Dark makes a quiet move and light is stuck.
    await setBoard(id, board({ "0,0": "a", "0,2": "a", "1,1": "b", "2,0": "a", "2,2": "a" }));
    await step(a, id, [S(2, 2), S(3, 3)], secs(T0, 2));
    const v = await view(a, id, secs(T0, 3));
    expect(v).toMatchObject({ status: "finished", winner: "a", endReason: "no_moves" });
  });

  it(`kings shuffling with no capture or man moving draw under the 40-move rule`, async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    const quiet = Array.from({ length: 79 }, (_, i) => ({ seat: i % 2 ? "a" : "b", path: [0, 4], captured: [], crowned: false, progress: false }));
    // 79 quiet moves so far, dark to move with a king.
    await setBoard(id, board({ "3,3": "A", "7,7": "B" }), quiet);
    const v0 = await view(a, id, T0);
    expect(v0.quietMoves).toBe(79);
    expect(v0.quietLimit).toBe(80);
    await step(a, id, [S(3, 3), S(4, 4)], secs(T0, 2));
    const v = await view(b, id, secs(T0, 3));
    expect(v).toMatchObject({ status: "finished", winner: "draw", endReason: "forty_moves" });
    const sb = await state(b, secs(T0, 4));
    expect(sb.games.record).toMatchObject({ draws: 1 });
  });

  it("a man moving resets the quiet count", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    const quiet = Array.from({ length: 79 }, (_, i) => ({ seat: i % 2 ? "a" : "b", path: [0, 4], progress: false }));
    await setBoard(id, board({ "3,3": "a", "7,7": "B" }), quiet);
    await step(a, id, [S(3, 3), S(4, 4)], secs(T0, 2));
    const v = await view(b, id, secs(T0, 3));
    expect(v.status).toBe("active");
    expect(v.quietMoves).toBe(0);
  });

  it("a missed turn plays the first legal move (a capture when due); two misses forfeit", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    await setBoard(id, board({ "2,2": "a", "0,6": "a", "3,3": "b", "7,7": "b" }));
    const v = await view(a, id, secs(T0, 61));
    expect(v.lastMove).toMatchObject({ seat: "a", path: [S(2, 2), S(4, 4)], auto: true });
    expect(v.players[0].misses).toBe(1);
    const end = await view(a, id, secs(T0, 60 * 10));
    expect(end.status).toBe("finished");
    expect(end.endReason).toBe("timeout");
  });

  it("rematch keeps the game: a draughts rematch is draughts", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    await cmd(b, "LeaveGameTable", { tableId: id }, secs(T0, 5));
    const r = await cmd(b, "Rematch", { tableId: id }, secs(T0, 6));
    const next = (r.receipt as { tableId: string }).tableId;
    await cmd(a, "Rematch", { tableId: id }, secs(T0, 7));
    const v = await view(b, next, secs(T0, 8));
    expect(v).toMatchObject({ game: "draughts", status: "active" });
    expect(v.board).toHaveLength(32);
    // B went second last time, so B moves first now, and the colours swap: B plays dark.
    expect(v.yourTurn).toBe(true);
    await step(b, next, [S(2, 2), S(3, 3)], secs(T0, 9));
  });

  it("unknown games are refused", async () => {
    const [a] = await players(1);
    await expect(cmd(a, "CreateGameTable", { mode: "friendly", game: "chess" }, T0)).rejects.toThrow(/isn't available/);
    await expect(cmd(a, "CreateGameTable", { mode: "friendly", game: 7 }, T0)).rejects.toThrow(/isn't available/);
    // Leaving the game out still opens Four in a Row, as before.
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    expect((await view(a, (r.receipt as { tableId: string }).tableId, T0)).game).toBe("four_in_row");
  });
});

describe("Draughts · practice against the NPC", () => {
  it("the labelled NPC replies at once with a legal move, and practice is never recorded", async () => {
    const [a] = await players(1);
    await at(a, "home");
    const r = await cmd(a, "CreateGameTable", { mode: "practice", game: "draughts" }, T0);
    expect((r.receipt as { message: string }).message).toMatch(/NPC/);
    const id = (r.receipt as { tableId: string }).tableId;
    let v = await view(a, id, T0);
    expect(v.players[1]).toMatchObject({ npc: true, name: expect.stringMatching(/NPC/) });
    await step(a, id, [S(2, 2), S(3, 3)], secs(T0, 1));
    v = await view(a, id, secs(T0, 2));
    expect(v.moveCount).toBe(2);
    expect(v.lastMove?.seat).toBe("b");
    expect(v.yourTurn).toBe(true);
    // Finish it by resigning: no result rows, no ladder rows.
    await cmd(a, "LeaveGameTable", { tableId: id }, secs(T0, 3));
    expect((await pool().query("SELECT 1 FROM game_results WHERE table_id = $1", [id])).rowCount).toBe(0);
    expect((await pool().query("SELECT 1 FROM game_ladder WHERE table_id = $1", [id])).rowCount).toBe(0);
    // Play again starts another draughts practice game.
    const again = await cmd(a, "Rematch", { tableId: id }, secs(T0, 4));
    const v2 = await view(a, (again.receipt as { tableId: string }).tableId, secs(T0, 5));
    expect(v2.game).toBe("draughts");
  });

  it("practice wins never score on the ladder", async () => {
    const [a] = await players(1);
    const r = await cmd(a, "CreateGameTable", { mode: "practice", game: "draughts" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    await setBoard(id, board({ "2,2": "a", "3,3": "b" }));
    await step(a, id, [S(2, 2), S(4, 4)], secs(T0, 1));
    expect((await view(a, id, secs(T0, 2))).winner).toBe("a");
    const s = await state(a, secs(T0, 3));
    expect(s.games.record.practiceWins).toBe(1);
    expect(s.ladder.boards.every((bd: { players: number }) => bd.players === 0)).toBe(true);
    expect(s.ladder.recent).toHaveLength(0);
  });
});

describe("Weekly ladder", () => {
  it("wins against real players score 3, draws 1; standings show per venue", async () => {
    const [a, b, c] = await players(3);
    await fourWin(a, b, T0);
    const { t } = await fourWin(c, b, secs(T0, 60));
    const s = await state(b, secs(t, 1));
    const pub = s.ladder.boards.find((x: { venueId: string }) => x.venueId === "last_stop_pub");
    expect(pub.top.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([
      ["Ada", 3],
      ["Cal", 3],
      ["Bea", 0],
    ]);
    expect(pub.you).toMatchObject({ rank: 3, points: 0, played: 2 });
    expect(s.ladder.weekKey).toBe("2026-10-05");
    expect(s.ladder.recent[0]).toMatchObject({ opponent: "Cal", outcome: "loss", points: 0, counted: true, game: "Four in a Row" });
    // No money anywhere.
    expect(await ledgerMatches(a)).toBe(true);
  });

  it("a draughts draw scores 1 each", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "draughts");
    const quiet = Array.from({ length: 79 }, (_, i) => ({ seat: i % 2 ? "a" : "b", path: [0, 4], progress: false }));
    await setBoard(id, board({ "3,3": "A", "7,7": "B" }), quiet);
    await step(a, id, [S(3, 3), S(4, 4)], secs(T0, 2));
    const rows = (await pool().query("SELECT outcome, points, counted FROM game_ladder WHERE table_id = $1", [id])).rows;
    expect(rows).toEqual([
      { outcome: "draw", points: 1, counted: true },
      { outcome: "draw", points: 1, counted: true },
    ]);
  });

  it("instant resignations don't count: both players must make three moves", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b, "four_in_row");
    await drop(a, id, 0, secs(T0, 2));
    await cmd(b, "LeaveGameTable", { tableId: id }, secs(T0, 3));
    const s = await state(a, secs(T0, 4));
    expect(s.ladder.recent[0]).toMatchObject({ outcome: "win", points: 0, counted: false, note: expect.stringMatching(/Too short/) });
    expect(s.ladder.boards[0].players).toBe(0);
    // Timed-out auto moves don't count as your own moves either.
    const id2 = await openGame(a, b, "four_in_row", secs(T0, 10));
    const v = await view(a, id2, secs(T0, 10 + 60 * 10));
    expect(v.status).toBe("finished");
    expect((await pool().query("SELECT counted FROM game_ladder WHERE table_id = $1", [id2])).rows.every((r) => !r.counted)).toBe(true);
  });

  it("the same pair only scores three games a week; a new week starts fresh", async () => {
    const [a, b] = await players(2);
    let t = T0;
    for (let i = 0; i < 4; i++) t = (await fourWin(a, b, secs(t, 10))).t;
    const s = await state(a, secs(t, 1));
    expect(s.ladder.boards[0].top[0]).toMatchObject({ name: "Ada", points: 9, wins: 3 });
    expect(s.ladder.recent[0]).toMatchObject({ counted: false, note: expect.stringMatching(/3 times/) });
    // Monday 12 Oct 19:00 London: a new week.
    const mon = new Date("2026-10-12T18:00:00Z");
    await fourWin(a, b, mon);
    const s2 = await state(a, secs(mon, 60));
    expect(s2.ladder.weekKey).toBe("2026-10-12");
    expect(s2.ladder.boards[0].top[0]).toMatchObject({ name: "Ada", points: 3 });
  });

  it("last week's champion is in the Hall of Fame and gets a profile badge; ties go to whoever got there first", async () => {
    const [a, b, c, d] = await players(4);
    // Ada and Cal both finish on 3 points; Ada got there first.
    await fourWin(a, b, T0);
    await fourWin(c, d, secs(T0, 120));
    const thisWeek = await state(c, secs(T0, 300));
    expect(thisWeek.ladder.boards[0].top.map((r: { name: string }) => r.name).slice(0, 2)).toEqual(["Ada", "Cal"]);
    expect(thisWeek.ladder.badges).toHaveLength(0);
    // Tuesday next week.
    const later = new Date("2026-10-13T12:00:00Z");
    const sa = await state(a, later);
    expect(sa.ladder.hallOfFame[0]).toMatchObject({ weekKey: "2026-10-05" });
    expect(sa.ladder.hallOfFame[0].champions).toEqual([{ venue: "The Last Stop", name: "Ada", points: 3, wins: 1, you: true }]);
    expect(sa.ladder.badges).toEqual([expect.objectContaining({ title: "The Last Stop Table Champion", weekKey: "2026-10-05" })]);
    const sc = await state(c, later);
    expect(sc.ladder.badges).toHaveLength(0);
    // This week's board is empty again.
    expect(sa.ladder.boards[0].top).toHaveLength(0);
  });

  it("a player can't score for someone else: only the seated players finish a game, and only once", async () => {
    const [a, b, c] = await players(3);
    const id = await openGame(a, b, "four_in_row");
    // A spectator can't resign either player or move.
    await expect(cmd(c, "LeaveGameTable", { tableId: id }, secs(T0, 1))).rejects.toThrow(/only watching/);
    await expect(cmd(c, "GameMove", { tableId: id, column: 0, version: 1 }, secs(T0, 1))).rejects.toThrow(/only the players/);
    // Two resignations racing: one result.
    let t = T0;
    for (const [acc, col] of [[a, 0], [b, 1], [a, 0], [b, 1], [a, 6], [b, 6]] as const) {
      t = secs(t, 2);
      await drop(acc, id, col, t);
    }
    await Promise.allSettled([cmd(a, "LeaveGameTable", { tableId: id }, secs(t, 1)), cmd(b, "LeaveGameTable", { tableId: id }, secs(t, 1))]);
    const rows = (await pool().query("SELECT character_id, outcome, points FROM game_ladder WHERE table_id = $1", [id])).rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.points).sort()).toEqual([0, 3]);
  });

  it("the weekly pair cap counts games whoever hosted, and other pairs are unaffected", async () => {
    const [a, b, c, d] = await players(4);
    // Two earlier counted games between A and B this week.
    let t = T0;
    for (let i = 0; i < 2; i++) t = (await fourWin(a, b, secs(t, 10))).t;
    // A third game counts; a fourth, hosted by B this time, does not.
    const third = await fourWin(a, b, secs(t, 10));
    const fourth = await fourWin(b, a, secs(third.t, 10));
    const counted = (await pool().query("SELECT COUNT(*)::int AS n FROM game_ladder WHERE character_id = (SELECT id FROM characters WHERE account_id = $1) AND counted", [a])).rows[0].n;
    expect(counted).toBe(3);
    expect((await pool().query("SELECT counted, note FROM game_ladder WHERE table_id = $1", [fourth.id])).rows[0]).toMatchObject({ counted: false, note: "pair_limit" });
    // Other pairs are unaffected.
    await fourWin(c, d, secs(fourth.t, 10));
    expect((await pool().query("SELECT COUNT(*)::int AS n FROM game_ladder WHERE counted AND character_id = (SELECT id FROM characters WHERE account_id = $1)", [c])).rows[0].n).toBe(1);
  });
});

describe("Games table in The Last Stop", () => {
  it("shows the live game at your venue, friendly first, and nothing elsewhere", async () => {
    const [a, b, c] = await players(3);
    expect((await state(c, T0)).games.here).toBeNull();
    const id = await openGame(a, b, "draughts");
    const s = await state(c, secs(T0, 1));
    expect(s.games.here).toMatchObject({ id, game: "draughts", players: ["Ada", "Bea"], mode: "friendly", yours: false });
    expect(s.games.here.board).toHaveLength(32);
    expect((await state(a, secs(T0, 1))).games.here.yours).toBe(true);
    await at(c, "home");
    expect((await state(c, secs(T0, 2))).games.here).toBeNull();
  });

  it("a practice game at the pub shows when no friendly game is on", async () => {
    const [a, c] = await players(2);
    await cmd(a, "CreateGameTable", { mode: "practice", game: "four_in_row" }, T0);
    const s = await state(c, secs(T0, 1));
    expect(s.games.here).toMatchObject({ mode: "practice", game: "four_in_row", players: ["Ada", expect.stringMatching(/NPC/)] });
  });
});
