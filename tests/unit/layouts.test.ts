import { describe, expect, it } from "vitest";
import { ACTIVITIES, VENUES } from "@/content/world";
import { LAYOUTS } from "@/world/venues/layouts";
import { buildVenueGrid } from "@/world/venues/props";
import { findPath, isBlocked, toCell } from "@/world/nav";

describe("venue layouts match venue content", () => {
  for (const v of VENUES.filter((x) => x.kind === "venue")) {
    const layout = LAYOUTS[v.id];
    it(`${v.id} has a layout, every NPC and every activity anchor`, () => {
      expect(layout).toBeDefined();
      for (const n of v.npcs) expect(layout.npcs.some((x) => x.id === n.id)).toBe(true);
      for (const a of ACTIVITIES.filter((x) => x.location === v.id)) {
        expect(a.anchor, `${a.id} needs an anchor`).toBeTruthy();
        expect(layout.anchors[a.anchor!], `${a.id} → ${a.anchor}`).toBeDefined();
      }
      expect(layout.anchors.exit).toBeDefined();
    });
    it(`${v.id}: every anchor is reachable from the entrance`, () => {
      const grid = buildVenueGrid(layout.shell.size, layout.props, [...layout.npcs.map((n) => n.pos), ...(layout.extras ?? []).map((e) => e.pos)]);
      const [si, sj] = toCell(grid, ...layout.spawn);
      expect(isBlocked(grid, si, sj)).toBe(false);
      for (const [id, a] of Object.entries(layout.anchors)) {
        const target = a.approach ?? a.pos;
        const path = findPath(grid, layout.spawn, target);
        expect(path.length, `${id} unreachable`).toBeGreaterThan(0);
        const end = path[path.length - 1];
        expect(Math.hypot(end[0] - target[0], end[1] - target[1]), `${id} too far`).toBeLessThan(0.9);
      }
    });
  }
});
