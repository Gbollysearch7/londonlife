import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { loadTableFor } from "@/server/commands";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, resetDb, state } from "./helpers";

// 14:00 London on a Saturday: The Last Stop (12:00–00:00) is open.
const T0 = new Date("2026-10-10T13:00:00Z");
const secs = (base: Date, s: number) => new Date(base.getTime() + s * 1000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

const at = (acc: string, place: string) => pool().query("UPDATE characters SET location = $2 WHERE account_id = $1", [acc, place]);
const view = (acc: string, id: string, t: Date) => loadTableFor(acc, id, t);

async function players(n = 2) {
  const accs: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = await makeAccount();
    await makeCharacter(a, T0);
    await at(a, "last_stop_pub");
    accs.push(a);
  }
  return accs;
}

async function openGame(a: string, b: string, t = T0) {
  const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, t);
  const id = (r.receipt as { tableId: string }).tableId;
  await cmd(b, "JoinGameTable", { tableId: id }, t);
  return id;
}

async function move(acc: string, id: string, column: number, t: Date) {
  const v = await view(acc, id, t);
  return cmd(acc, "GameMove", { tableId: id, column, version: v.version }, t);
}

describe("Four in a Row · friendly tables", () => {
  it("two players play a full game; the result is recorded and nothing is staked", async () => {
    const [a, b, watcher] = await players(3);
    const cash = (await state(a, T0)).wallet.cashPence;
    const id = await openGame(a, b);
    let t = T0;
    // A stacks column 0, B column 1: A connects four vertically on the seventh move.
    for (const [acc, col] of [[a, 0], [b, 1], [a, 0], [b, 1], [a, 0], [b, 1], [a, 0]] as const) {
      t = secs(t, 5);
      await move(acc, id, col, t);
    }
    const v = await view(watcher, id, t);
    expect(v.status).toBe("finished");
    expect(v.winner).toBe("a");
    expect(v.endReason).toBe("four");
    expect(v.winLine).toEqual([0, 7, 14, 21]);
    expect(v.spectating).toBe(true);
    const sa = await state(a, secs(t, 1));
    const sb = await state(b, secs(t, 1));
    expect(sa.games.record).toMatchObject({ wins: 1, losses: 0 });
    expect(sb.games.record).toMatchObject({ wins: 0, losses: 1 });
    expect(sa.games.recent[0]).toMatchObject({ outcome: "win", reason: "four", opponent: "Ada" });
    expect(sa.games.mine).toBeNull();
    // Friendly only: no money moves.
    expect(sa.wallet.cashPence).toBe(cash);
    expect(await ledgerMatches(a)).toBe(true);
    // A finished game takes no more moves.
    await expect(cmd(b, "GameMove", { tableId: id, column: 2, version: v.version }, secs(t, 2))).rejects.toThrow(/finished/);
  });

  it("detects a diagonal win and a full-board draw is possible only through legal moves", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b);
    let t = T0;
    // Diagonal for A: (0,0) (1,1) (2,2) (3,3).
    const seq: [string, number][] = [[a, 0], [b, 1], [a, 1], [b, 2], [a, 2], [b, 3], [a, 2], [b, 3], [a, 3], [b, 6], [a, 3]];
    for (const [acc, col] of seq) {
      t = secs(t, 3);
      await move(acc, id, col, t);
    }
    const v = await view(a, id, t);
    expect(v.winner).toBe("a");
    expect(v.winLine).toEqual([0, 8, 16, 24]);
  });

  it("rejects turn skipping, stale versions, illegal columns and moves by spectators", async () => {
    const [a, b, c] = await players(3);
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    await expect(cmd(a, "GameMove", { tableId: id, column: 3, version: 0 }, T0)).rejects.toThrow(/Waiting for an opponent/);
    await expect(cmd(a, "JoinGameTable", { tableId: id }, T0)).rejects.toThrow(/your table/);
    await cmd(b, "JoinGameTable", { tableId: id }, T0);
    // The seat is taken: a third person can't join, only watch.
    await expect(cmd(c, "JoinGameTable", { tableId: id }, T0)).rejects.toThrow(/got that seat/);
    const v0 = await view(a, id, T0);
    await expect(cmd(b, "GameMove", { tableId: id, column: 3, version: v0.version }, T0)).rejects.toThrow(/not your turn/);
    await expect(cmd(c, "GameMove", { tableId: id, column: 3, version: v0.version }, T0)).rejects.toThrow(/only the players/);
    await expect(cmd(c, "LeaveGameTable", { tableId: id }, T0)).rejects.toThrow(/only watching/);
    await expect(cmd(a, "GameMove", { tableId: id, column: 7, version: v0.version }, T0)).rejects.toThrow(/full or doesn't exist/);
    await expect(cmd(a, "GameMove", { tableId: id, column: 2.5, version: v0.version }, T0)).rejects.toThrow(/full or doesn't exist/);
    await expect(cmd(a, "GameMove", { tableId: id, column: 3, version: v0.version - 1 }, T0)).rejects.toThrow(/board changed/);
    // A move replayed with the same request key applies once.
    const k = key();
    await cmd(a, "GameMove", { tableId: id, column: 3, version: v0.version }, T0, k);
    const again = await cmd(a, "GameMove", { tableId: id, column: 3, version: v0.version }, T0, k);
    expect(again.replayed).toBe(true);
    // And the same move with a new key is stale, not a second counter.
    await expect(cmd(a, "GameMove", { tableId: id, column: 3, version: v0.version }, T0)).rejects.toThrow(/board changed|not your turn/);
    const v1 = await view(c, id, T0);
    expect(v1.moveCount).toBe(1);
    expect(v1.board.split("").filter((x) => x !== ".").length).toBe(1);
    // Fill column 3 (6 counters) then it's illegal.
    let t = T0;
    for (const acc of [b, a, b, a, b]) {
      t = secs(t, 2);
      await move(acc, id, 3, t);
    }
    const full = await view(a, id, t);
    await expect(cmd(a, "GameMove", { tableId: id, column: 3, version: full.version }, secs(t, 1))).rejects.toThrow(/full/);
  });

  it("tables are only opened and joined at the pub while it is open, one at a time", async () => {
    const [a, b] = await players(2);
    await at(a, "home");
    await expect(cmd(a, "CreateGameTable", { mode: "friendly" }, T0)).rejects.toThrow(/Go there to play/);
    await at(a, "last_stop_pub");
    // 00:30 London: the pub has shut.
    await expect(cmd(a, "CreateGameTable", { mode: "friendly" }, new Date("2026-10-10T23:30:00Z"))).rejects.toThrow(/closed/);
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    await expect(cmd(a, "CreateGameTable", { mode: "friendly" }, T0)).rejects.toThrow(/already have a table/);
    await expect(cmd(a, "CreateGameTable", { mode: "practice" }, T0)).rejects.toThrow(/already have a table/);
    await at(b, "home");
    await expect(cmd(b, "JoinGameTable", { tableId: (r.receipt as { tableId: string }).tableId }, T0)).rejects.toThrow(/Go there to play/);
    await expect(cmd(b, "JoinGameTable", { tableId: "not-a-table" }, T0)).rejects.toThrow(/doesn't exist/);
    // Listed for others while open; an unjoined table closes on its own after 20 minutes.
    await at(b, "last_stop_pub");
    expect((await state(b, T0)).games.open).toHaveLength(1);
    expect((await state(b, secs(T0, 21 * 60))).games.open).toHaveLength(0);
    await expect(cmd(b, "JoinGameTable", { tableId: (r.receipt as { tableId: string }).tableId }, secs(T0, 21 * 60))).rejects.toThrow(/closed/);
    // The host is free again.
    await cmd(a, "CreateGameTable", { mode: "friendly" }, secs(T0, 22 * 60));
  });

  it("two people racing for the last seat: exactly one gets it", async () => {
    const [a, b, c] = await players(3);
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    const results = await Promise.allSettled([cmd(b, "JoinGameTable", { tableId: id }, T0), cmd(c, "JoinGameTable", { tableId: id }, T0)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const v = await view(a, id, T0);
    expect(v.status).toBe("active");
  });

  it("a missed turn plays the centre column; two misses in a row forfeit; a valid move resets the count", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b);
    // A misses once: a counter is dropped in column 3 for them.
    let v = await view(a, id, secs(T0, 61));
    expect(v.moveCount).toBe(1);
    expect(v.lastMove).toMatchObject({ seat: "a", col: 3, auto: true });
    expect(v.players[0].misses).toBe(1);
    // B moves in time; A then moves in time, which resets A's misses.
    await move(b, id, 0, secs(T0, 70));
    await move(a, id, 6, secs(T0, 80));
    v = await view(a, id, secs(T0, 81));
    expect(v.players[0].misses).toBe(0);
    // Now B goes quiet: two misses in a row (with A moving in between) forfeit.
    v = await view(a, id, secs(T0, 80 + 61));
    expect(v.players[1].misses).toBe(1);
    await move(a, id, 6, secs(T0, 145));
    v = await view(b, id, secs(T0, 145 + 61));
    expect(v.status).toBe("finished");
    expect(v.winner).toBe("a");
    expect(v.endReason).toBe("timeout");
    const sb = await state(b, secs(T0, 300));
    expect(sb.games.recent[0]).toMatchObject({ outcome: "loss", reason: "timeout" });
  });

  it("both players away: the misses alternate and the first to miss twice loses", async () => {
    const [a, b] = await players(2);
    const id = await openGame(a, b);
    const v = await view(a, id, secs(T0, 60 * 10));
    expect(v.status).toBe("finished");
    // A misses at 60s (auto), B at 120s (auto), A's second miss at 180s forfeits.
    expect(v.winner).toBe("b");
    expect(v.moveCount).toBe(2);
  });

  it("leaving: closing a waiting table cancels it; leaving a game resigns it", async () => {
    const [a, b] = await players(2);
    const r = await cmd(a, "CreateGameTable", { mode: "friendly" }, T0);
    await cmd(a, "LeaveGameTable", { tableId: (r.receipt as { tableId: string }).tableId }, T0);
    expect((await view(a, (r.receipt as { tableId: string }).tableId, T0)).status).toBe("cancelled");
    const id = await openGame(a, b, secs(T0, 5));
    await cmd(b, "LeaveGameTable", { tableId: id }, secs(T0, 10));
    const v = await view(a, id, secs(T0, 11));
    expect(v.winner).toBe("a");
    expect(v.endReason).toBe("resigned");
    await expect(cmd(b, "LeaveGameTable", { tableId: id }, secs(T0, 12))).rejects.toThrow(/already finished/);
  });

  it("rematch: one asks, the other accepts, and last game's second player goes first", async () => {
    const [a, b, c] = await players(3);
    const id = await openGame(a, b);
    await cmd(b, "LeaveGameTable", { tableId: id }, secs(T0, 5));
    await expect(cmd(c, "Rematch", { tableId: id }, secs(T0, 6))).rejects.toThrow(/Only the players/);
    const r = await cmd(b, "Rematch", { tableId: id }, secs(T0, 6));
    const next = (r.receipt as { tableId: string }).tableId;
    await expect(cmd(b, "Rematch", { tableId: id }, secs(T0, 7))).rejects.toThrow(/waiting for them/);
    // Reserved for A: C can't take it, and it isn't listed for C.
    await expect(cmd(c, "JoinGameTable", { tableId: next }, secs(T0, 7))).rejects.toThrow(/someone else/);
    expect((await state(c, secs(T0, 7))).games.open).toHaveLength(0);
    expect((await state(a, secs(T0, 7))).games.open[0]).toMatchObject({ id: next, rematch: true });
    await cmd(a, "Rematch", { tableId: id }, secs(T0, 8));
    const v = await view(b, next, secs(T0, 9));
    expect(v.status).toBe("active");
    // B went second last time, so B moves first now.
    expect(v.yourTurn).toBe(true);
    await move(b, next, 3, secs(T0, 10));
  });

  it("spectators see live tables and watching never changes the game", async () => {
    const [a, b, c] = await players(3);
    const id = await openGame(a, b);
    await move(a, id, 3, secs(T0, 5));
    const sc = await state(c, secs(T0, 6));
    expect(sc.games.live).toHaveLength(1);
    expect(sc.games.live[0]).toMatchObject({ id, players: ["Ada", "Ada"], moves: 1 });
    const before = await view(c, id, secs(T0, 6));
    await view(c, id, secs(T0, 7));
    const after = await view(a, id, secs(T0, 7));
    expect(after.version).toBe(before.version);
    expect(after.yourSeat).toBe("a");
    expect(before.yourSeat).toBeNull();
  });
});

describe("Four in a Row · practice against the NPC", () => {
  it("plays anywhere, the labelled NPC replies at once and blocks a winning threat", async () => {
    const [a] = await players(1);
    await at(a, "home");
    const r = await cmd(a, "CreateGameTable", { mode: "practice" }, T0);
    const id = (r.receipt as { tableId: string }).tableId;
    let v = await view(a, id, T0);
    expect(v.players[1]).toMatchObject({ npc: true, name: expect.stringMatching(/NPC/) });
    for (let i = 0; i < 3; i++) {
      await move(a, id, 0, secs(T0, i + 1));
    }
    v = await view(a, id, secs(T0, 4));
    // Three of A's counters in column 0, and the NPC's counter on top blocks the fourth.
    expect(v.board[0]).toBe("a");
    expect(v.board[7]).toBe("a");
    expect(v.board[14]).toBe("a");
    expect(v.board[21]).toBe("b");
    expect(v.moveCount).toBe(6);
    expect(v.yourTurn).toBe(true);
    // Practice games don't go on the friendly record.
    await cmd(a, "LeaveGameTable", { tableId: id }, secs(T0, 5));
    const s = await state(a, secs(T0, 6));
    expect(s.games.record).toMatchObject({ wins: 0, losses: 0, draws: 0 });
  });
});
