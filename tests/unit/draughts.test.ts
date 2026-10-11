import { describe, expect, it } from "vitest";
import {
  QUIET_MOVES_EACH,
  colOf,
  draughtsAiMove,
  draughtsAutoMove,
  draughtsOutcome,
  draughtsStart,
  illegalReason,
  legalMoves,
  parsePath,
  playDraughts,
  quietRun,
  rowOf,
  sq,
} from "@/content/draughts";
import { tableGame } from "@/content/tableGames";
import { ladderWeekKey, rankLadder, weeksBefore } from "@/content/ladder";

/** A board with only the given pieces: { "row,col": "a" | "b" | "A" | "B" }. */
function board(pieces: Record<string, string>) {
  const b = ".".repeat(32).split("");
  for (const [k, v] of Object.entries(pieces)) {
    const [r, c] = k.split(",").map(Number);
    const i = sq(r, c);
    if (i < 0) throw new Error(`light square ${k}`);
    b[i] = v;
  }
  return b.join("");
}
const S = (r: number, c: number) => sq(r, c);

describe("Draughts · board and moves", () => {
  it("maps the 32 dark squares and starts with twelve men each", () => {
    for (let i = 0; i < 32; i++) expect(sq(rowOf(i), colOf(i))).toBe(i);
    expect(sq(0, 1)).toBe(-1);
    expect(sq(8, 0)).toBe(-1);
    const b = draughtsStart();
    expect([...b].filter((x) => x === "a")).toHaveLength(12);
    expect([...b].filter((x) => x === "b")).toHaveLength(12);
    // Dark has seven opening moves, all one step diagonally forward.
    const m = legalMoves(b, "a");
    expect(m).toHaveLength(7);
    for (const [from, to] of m) expect(rowOf(to) - rowOf(from)).toBe(1);
    expect(legalMoves(b, "b")).toHaveLength(7);
  });

  it("men only move forward; kings move both ways", () => {
    const b = board({ "3,3": "a", "4,0": "b", "5,5": "B" });
    expect(legalMoves(b, "a").map((m) => m[1]).sort()).toEqual([S(4, 2), S(4, 4)].sort());
    // The b man moves down the board only; the b king moves in all four directions.
    const bm = legalMoves(b, "b");
    expect(bm.filter((m) => m[0] === S(4, 0)).map((m) => m[1])).toEqual([S(3, 1)]);
    expect(bm.filter((m) => m[0] === S(5, 5))).toHaveLength(4);
  });

  it("captures are compulsory", () => {
    const b = board({ "2,2": "a", "0,6": "a", "3,3": "b" });
    expect(legalMoves(b, "a")).toEqual([[S(2, 2), S(4, 4)]]);
    expect(playDraughts(b, "a", [S(0, 6), S(1, 7)])).toBeNull();
    expect(illegalReason(b, "a", [S(0, 6), S(1, 7)])).toMatch(/must take/);
    const r = playDraughts(b, "a", [S(2, 2), S(4, 4)])!;
    expect(r.captured).toEqual([S(3, 3)]);
    expect(r.board[S(3, 3)]).toBe(".");
    expect(r.board[S(4, 4)]).toBe("a");
    expect(r.progress).toBe(true);
  });

  it("multi-jumps must be completed, and any complete capture route may be chosen", () => {
    const b = board({ "0,0": "a", "1,1": "b", "3,3": "b", "3,1": "b" });
    const legal = legalMoves(b, "a");
    // From (2,2) the man can carry on over (3,3) or over (3,1).
    expect(legal).toContainEqual([S(0, 0), S(2, 2), S(4, 4)]);
    expect(legal).toContainEqual([S(0, 0), S(2, 2), S(4, 0)]);
    expect(legal).toHaveLength(2);
    expect(playDraughts(b, "a", [S(0, 0), S(2, 2)])).toBeNull();
    expect(illegalReason(b, "a", [S(0, 0), S(2, 2)])).toMatch(/Keep jumping/);
    const r = playDraughts(b, "a", [S(0, 0), S(2, 2), S(4, 4)])!;
    expect(r.captured).toEqual([S(1, 1), S(3, 3)]);
    expect(r.board[S(3, 1)]).toBe("b");
  });

  it("a man reaching the far row is crowned and its move ends there", () => {
    // After crowning on (7,3) a king could jump (6,4) backwards — but the move must stop.
    const b = board({ "5,1": "a", "6,2": "b", "6,4": "b" });
    expect(legalMoves(b, "a")).toEqual([[S(5, 1), S(7, 3)]]);
    const r = playDraughts(b, "a", [S(5, 1), S(7, 3)])!;
    expect(r.crowned).toBe(true);
    expect(r.board[S(7, 3)]).toBe("A");
    // A simple step onto the far row crowns too; light crowns on row 0.
    const s = playDraughts(board({ "1,1": "b" }), "b", [S(1, 1), S(0, 0)])!;
    expect(s.board[S(0, 0)]).toBe("B");
  });

  it("a king captures backwards and keeps jumping", () => {
    const b = board({ "4,4": "A", "3,3": "b", "1,3": "b" });
    expect(legalMoves(b, "a")).toEqual([[S(4, 4), S(2, 2), S(0, 4)]]);
    const r = playDraughts(b, "a", [S(4, 4), S(2, 2), S(0, 4)])!;
    expect(r.board[S(0, 4)]).toBe("A");
    expect(r.crowned).toBe(false);
  });

  it("a player with no pieces or no legal move loses", () => {
    expect(draughtsOutcome(board({ "3,3": "a" }), "b", 0)).toEqual({ winner: "a", reason: "no_moves" });
    // Dark's only man is blocked: light's men in front, nothing to jump into.
    const blocked = board({ "6,0": "a", "7,1": "b", "5,3": "b" });
    expect(legalMoves(blocked, "a")).toEqual([]);
    expect(draughtsOutcome(blocked, "a", 0)).toEqual({ winner: "b", reason: "no_moves" });
    expect(draughtsOutcome(draughtsStart(), "a", 0)).toBeNull();
  });

  it(`draws after ${QUIET_MOVES_EACH} moves each with no capture and no man moving`, () => {
    const b = board({ "3,3": "A", "6,6": "B" });
    expect(draughtsOutcome(b, "a", QUIET_MOVES_EACH * 2 - 1)).toBeNull();
    expect(draughtsOutcome(b, "a", QUIET_MOVES_EACH * 2)).toEqual({ winner: "draw", reason: "forty_moves" });
    expect(quietRun([{ progress: true }, { progress: false }, { progress: false }])).toBe(2);
    expect(quietRun([{ progress: false }, { progress: true }])).toBe(0);
    // Kings moving is quiet; a man moving is progress.
    expect(playDraughts(b, "a", [S(3, 3), S(2, 2)])!.progress).toBe(false);
    expect(playDraughts(board({ "3,3": "a", "6,6": "B" }), "a", [S(3, 3), S(4, 4)])!.progress).toBe(true);
  });

  it("rejects malformed paths", () => {
    expect(parsePath("1,2")).toBeNull();
    expect(parsePath([1])).toBeNull();
    expect(parsePath([1, 32])).toBeNull();
    expect(parsePath([1.5, 2])).toBeNull();
    expect(parsePath(Array(14).fill(1))).toBeNull();
    expect(parsePath([8, 12])).toEqual([8, 12]);
    expect(playDraughts(draughtsStart(), "a", [8, 20])).toBeNull();
    expect(playDraughts(draughtsStart(), "b", [8, 12])).toBeNull();
  });
});

describe("Draughts · practice opponent and auto moves", () => {
  it("takes the bigger capture and crowns when it can", () => {
    // Two capture routes for light: a single or a double; the AI takes two.
    const b = board({ "5,5": "b", "4,4": "a", "4,6": "a", "2,6": "a", "0,0": "a" });
    const m = draughtsAiMove(b, "b")!;
    expect(m).toEqual([S(5, 5), S(3, 7), S(1, 5)]);
    const crown = board({ "1,1": "b", "6,6": "a" });
    // Both moves crown here; with a third piece that could step instead, crowning still wins out.
    const crown2 = board({ "1,1": "b", "6,6": "b", "3,7": "a" });
    expect(rowOf(draughtsAiMove(crown, "b")![1])).toBe(0);
    expect(rowOf(draughtsAiMove(crown2, "b")![1])).toBe(0);
  });

  it("doesn't step into an immediate capture when a safe move exists", () => {
    // Moving (5,3)->(4,4) would be jumped by the dark man on (3,5); (5,3)->(4,2) is safe.
    const b = board({ "5,3": "b", "3,5": "a", "0,0": "a" });
    expect(draughtsAiMove(b, "b")).toEqual([S(5, 3), S(4, 2)]);
  });

  it("is deterministic, always legal, and AI-vs-AI games always end", () => {
    for (let game = 0; game < 4; game++) {
      let b = draughtsStart();
      let seat: "a" | "b" = "a";
      const moves: { progress: boolean }[] = [];
      let end = null;
      // Seed variety: the first few dark moves are taken from the auto move list at different offsets.
      for (let ply = 0; ply < 600 && !end; ply++) {
        const legal = legalMoves(b, seat);
        const m = ply < 2 ? legal[(game + ply) % legal.length] : draughtsAiMove(b, seat)!;
        expect(draughtsAiMove(b, seat)).toEqual(draughtsAiMove(b, seat));
        const r = playDraughts(b, seat, m);
        expect(r).not.toBeNull();
        b = r!.board;
        moves.push({ progress: r!.progress });
        seat = seat === "a" ? "b" : "a";
        end = draughtsOutcome(b, seat, quietRun(moves));
      }
      expect(end).not.toBeNull();
    }
  });

  it("the timed-out move is the first legal move, a capture when one is due", () => {
    const b = board({ "2,2": "a", "0,6": "a", "3,3": "b" });
    expect(draughtsAutoMove(b, "a")).toEqual([S(2, 2), S(4, 4)]);
    expect(draughtsAutoMove(board({ "3,3": "a" }), "b")).toBeNull();
  });

  it("plugs into the table game registry next to Four in a Row", () => {
    const g = tableGame("draughts")!;
    expect(g.emptyBoard()).toHaveLength(32);
    expect(g.parseMove({ path: [8, 12] })).toEqual([8, 12]);
    expect(g.parseMove({ column: 3 })).toBeNull();
    const r = g.play(g.emptyBoard(), "a", [8, 12])!;
    expect(r.record).toMatchObject({ path: [8, 12], captured: [], crowned: false, progress: true });
    expect(g.end(r.board, "b", [{ seat: "a", ...r.record }])).toBeNull();
    const f = tableGame("four_in_row")!;
    expect(f.parseMove({ column: 3 })).toBe(3);
    expect(f.play(f.emptyBoard(), "a", 3)!.record).toEqual({ col: 3 });
    expect(tableGame("chess")).toBeUndefined();
  });
});

describe("Weekly ladder · calendar and ranking", () => {
  it("weeks start Monday 00:00 London, across the clock change", () => {
    // Sunday 25 Oct 2026 23:30 London (GMT) is still the week of Monday 19 Oct.
    expect(ladderWeekKey(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-19");
    expect(ladderWeekKey(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
    // Monday 00:30 BST is Sunday 23:30 UTC, but already the new week in London.
    expect(ladderWeekKey(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
    expect(ladderWeekKey(new Date("2026-10-11T22:59:00Z"))).toBe("2026-10-05");
    expect(weeksBefore("2026-10-12", 1)).toBe("2026-10-05");
    expect(weeksBefore("2026-10-12", -1)).toBe("2026-10-19");
  });

  it("ranks by points, then wins, then who got there first", () => {
    const r = rankLadder([
      { characterId: "x", points: 3, wins: 1, reachedAt: 5 },
      { characterId: "y", points: 4, wins: 1, reachedAt: 9 },
      { characterId: "z", points: 3, wins: 1, reachedAt: 2 },
      { characterId: "w", points: 3, wins: 0, reachedAt: 1 },
    ]);
    expect(r.map((x) => x.characterId)).toEqual(["y", "z", "x", "w"]);
  });
});
