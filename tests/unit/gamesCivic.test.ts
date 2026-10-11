import { describe, expect, it } from "vitest";
import { aiMove, autoMove, drop, emptyBoard, landingRow, legalColumns, outcome, winningLine, type Seat } from "@/content/fourInRow";
import { pickWinner, policyActivityCost, policyGroceryPrice, policyQuote, policyVenue, previousRaceKey, raceClose, raceKeyAt } from "@/content/civic";

const play = (cols: number[], first: Seat = "a") => {
  let b = emptyBoard();
  let s: Seat = first;
  for (const c of cols) {
    const d = drop(b, c, s);
    if (!d) throw new Error(`illegal ${c}`);
    b = d.board;
    s = s === "a" ? "b" : "a";
  }
  return b;
};

describe("Four in a Row rules", () => {
  it("counters fall to the lowest free row; a full column is illegal", () => {
    let b = emptyBoard();
    for (let i = 0; i < 6; i++) {
      expect(landingRow(b, 2)).toBe(i);
      b = drop(b, 2, i % 2 ? "b" : "a")!.board;
    }
    expect(landingRow(b, 2)).toBe(-1);
    expect(drop(b, 2, "a")).toBeNull();
    expect(legalColumns(b)).toEqual([0, 1, 3, 4, 5, 6]);
    expect(drop(b, -1, "a")).toBeNull();
    expect(drop(b, 7, "a")).toBeNull();
  });

  it("finds horizontal, vertical and both diagonal lines", () => {
    expect(winningLine(play([0, 0, 1, 1, 2, 2, 3]), "a")).toEqual([0, 1, 2, 3]);
    expect(winningLine(play([5, 0, 5, 0, 5, 0, 5]), "a")).toEqual([5, 12, 19, 26]);
    expect(winningLine(play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]), "a")).toEqual([0, 8, 16, 24]);
    // Anti-diagonal: (0,6) (1,5) (2,4) (3,3).
    expect(winningLine(play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]), "a")).not.toBeNull();
    expect(outcome(play([0, 1, 2]))).toBeNull();
  });

  it("a full board without a line is a draw", () => {
    // Columns filled in pairs so no four line up: pattern by column groups.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const b = play(order);
    expect(legalColumns(b)).toEqual([]);
    expect(outcome(b)).toEqual({ winner: "draw", line: null });
  });

  it("automatic moves take the most central free column", () => {
    expect(autoMove(emptyBoard())).toBe(3);
    const b = play([3, 3, 3, 3, 3, 3]);
    expect(autoMove(b)).toBe(2);
  });

  it("the practice opponent takes a win, blocks a win, and is deterministic", () => {
    // b to move with three b's in column 6 → wins there.
    const winB = play([0, 6, 1, 6, 0, 6, 5]);
    expect(aiMove(winB, "b")).toBe(6);
    // a threatens 0-1-2 along the bottom → b blocks at 3.
    const threat = play([0, 6, 1, 6, 2]);
    expect(aiMove(threat, "b")).toBe(3);
    expect(aiMove(threat, "b")).toBe(aiMove(threat, "b"));
    // Opening: centre.
    expect(aiMove(play([0]), "b")).toBe(3);
  });
});

describe("City Mayor calendar and policies", () => {
  it("races close Sunday 20:00 London, across the clock change", () => {
    expect(raceKeyAt(new Date("2026-10-10T13:00:00Z"))).toBe("2026-10-11");
    expect(raceClose("2026-10-11").toISOString()).toBe("2026-10-11T19:00:00.000Z");
    // Clocks go back on 25 October: that close is 20:00 GMT.
    expect(raceClose("2026-10-25").toISOString()).toBe("2026-10-25T20:00:00.000Z");
    expect(raceKeyAt(new Date("2026-10-25T19:30:00Z"))).toBe("2026-10-25");
    expect(previousRaceKey(new Date("2026-10-25T19:30:00Z"))).toBe("2026-10-18");
    expect(previousRaceKey(new Date("2026-10-25T20:00:00Z"))).toBe("2026-10-25");
    // A ballot exactly at the close belongs to next week.
    expect(raceKeyAt(new Date("2026-10-11T19:00:00Z"))).toBe("2026-10-18");
  });

  it("winner: most votes, then earliest to stand; nobody wins with no votes", () => {
    const t = (m: number) => new Date(2026, 0, 1, 0, m);
    expect(pickWinner([])).toBeNull();
    expect(pickWinner([{ candidateId: "x", votes: 0, stoodAt: t(0) }])).toBeNull();
    expect(pickWinner([{ candidateId: "x", votes: 2, stoodAt: t(5) }, { candidateId: "y", votes: 3, stoodAt: t(9) }])!.candidateId).toBe("y");
    expect(pickWinner([{ candidateId: "x", votes: 2, stoodAt: t(5) }, { candidateId: "y", votes: 2, stoodAt: t(1) }])!.candidateId).toBe("y");
  });

  it("policy hooks change only what they say", () => {
    const bus = { mode: "bus", farePence: 200, minutes: 5 };
    expect(policyQuote("half_price_buses", bus).farePence).toBe(100);
    expect(policyQuote("half_price_buses", { ...bus, mode: "tube", farePence: 280 }).farePence).toBe(280);
    expect(policyQuote("status_quo", bus).farePence).toBe(200);
    const friday = new Date("2026-10-16T10:00:00Z");
    expect(policyActivityCost("free_gym_fridays", { id: "gym_weights", costPence: 800 }, friday)).toBe(0);
    expect(policyActivityCost("free_gym_fridays", { id: "gym_shake", costPence: 400 }, friday)).toBe(400);
    expect(policyActivityCost("free_gym_fridays", { id: "gym_weights", costPence: 800 }, new Date("2026-10-15T10:00:00Z"))).toBe(800);
    expect(policyVenue("library_late_nights", { id: "reading_library", hours: [9, 20] as [number, number] }).hours).toEqual([9, 23]);
    expect(policyVenue("library_late_nights", { id: "food_hall", hours: undefined }).hours).toBeUndefined();
    expect(policyGroceryPrice("market_rates_freeze", "borough_market", 250)).toBe(200);
    expect(policyGroceryPrice("market_rates_freeze", "food_hall", 250)).toBe(250);
  });
});
