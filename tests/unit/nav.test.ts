import { describe, expect, it } from "vitest";
import { blockRect, findPath, isBlocked, lineClear, makeGrid, nearestFree, toCell } from "@/world/nav";

describe("avatar navigation grid", () => {
  it("walks straight across an empty room in one leg", () => {
    const g = makeGrid(6, 6, 0.5);
    const path = findPath(g, [-2.5, -2.5], [2.4, 2.3]);
    expect(path).toEqual([[2.4, 2.3]]);
  });

  it("goes around an obstacle and never crosses a blocked cell", () => {
    const g = makeGrid(6, 6, 0.5);
    blockRect(g, -1, -3, 1, 2); // wall across the middle, open only at the far edge
    const path = findPath(g, [-2.5, -2], [2.5, -2]);
    expect(path.length).toBeGreaterThan(1);
    let prev: [number, number] = [-2.5, -2];
    for (const p of path) {
      expect(lineClear(g, prev, p)).toBe(true);
      prev = p;
    }
    expect(path[path.length - 1]).toEqual([2.5, -2]);
  });

  it("snaps an unreachable goal inside furniture to the nearest free cell", () => {
    const g = makeGrid(4, 4, 1);
    blockRect(g, 0, 0, 2, 2);
    const [i, j] = toCell(g, 1.5, 1.5);
    expect(isBlocked(g, i, j)).toBe(true);
    const path = findPath(g, [-1.5, -1.5], [1.5, 1.5]);
    const end = path[path.length - 1];
    const [ei, ej] = toCell(g, end[0], end[1]);
    expect(isBlocked(g, ei, ej)).toBe(false);
  });

  it("steps out first when starting inside an obstacle (getting off a bed)", () => {
    const g = makeGrid(4, 4, 1);
    blockRect(g, -2, -2, 0, 0);
    const path = findPath(g, [-1.5, -1.5], [1.5, 1.5]);
    const [i, j] = toCell(g, path[0][0], path[0][1]);
    expect(isBlocked(g, i, j)).toBe(false);
  });

  it("returns an empty path when the goal region is sealed off", () => {
    const g = makeGrid(5, 1, 1);
    blockRect(g, -0.5, -1, 0.5, 1);
    expect(findPath(g, [-2, 0], [2, 0])).toEqual([]);
  });

  it("finds the nearest free cell and reports a full grid", () => {
    const g = makeGrid(3, 3, 1);
    blockRect(g, -1.5, -1.5, 1.5, 1.5);
    expect(nearestFree(g, 1, 1)).toBeNull();
    g.blocked[0] = 0;
    expect(nearestFree(g, 1, 1)).toEqual([0, 0]);
  });
});
