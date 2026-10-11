import { describe, expect, it } from "vitest";
import { STORIES, TREASURE_SPOTS, choiceChance, storyLayout, storyNode, treasureReward } from "@/content/stories";
import { VENUES } from "@/content/world";
import { LAYOUTS } from "@/world/venues/layouts";

describe("story graphs", () => {
  for (const s of STORIES) {
    it(`${s.id} is a well-formed graph`, () => {
      const ids = new Set(s.nodes.map((n) => n.id));
      expect(ids.size).toBe(s.nodes.length);
      expect(ids.has(s.start)).toBe(true);
      expect(s.nodes.length).toBeGreaterThanOrEqual(5);
      const endings = s.nodes.filter((n) => n.ending);
      expect(endings.length).toBeGreaterThanOrEqual(2);
      for (const n of s.nodes) {
        if (n.location) expect(VENUES.some((v) => v.id === n.location)).toBe(true);
        if (n.ending) expect(n.choices).toHaveLength(0);
        else expect(n.choices.length).toBeGreaterThan(0);
        for (const c of n.choices) {
          expect(ids.has(c.next), `${n.id}.${c.id} → ${c.next}`).toBe(true);
          if (c.failNext) expect(ids.has(c.failNext)).toBe(true);
          if (c.chance) expect(c.failNext ?? c.next).toBeTruthy();
        }
      }
      // Every node is reachable from the start, and every non-ending node can reach an ending.
      const { pos } = storyLayout(s);
      for (const n of s.nodes) expect(pos[n.id], `${n.id} unreachable`).toBeDefined();
      for (const n of s.nodes.filter((x) => !x.ending)) {
        const seen = new Set<string>();
        const q = [n.id];
        let ok = false;
        while (q.length && !ok) {
          const cur = storyNode(s, q.shift()!)!;
          if (cur.ending) ok = true;
          for (const c of cur.choices) for (const to of [c.next, c.failNext]) if (to && !seen.has(to)) (seen.add(to), q.push(to));
        }
        expect(ok, `${n.id} has no path to an ending`).toBe(true);
      }
      // There is always an ungated route forward from every scene (an affordable, skill-free path).
      for (const n of s.nodes.filter((x) => !x.ending)) expect(n.choices.some((c) => !c.requires && !c.costPence), `${n.id} needs a free route`).toBe(true);
    });
  }
  it("clamps chances between 5% and 95%", () => {
    expect(choiceChance({ id: "a", label: "", next: "x", chance: { base: 2 } }, {})).toBe(0.95);
    expect(choiceChance({ id: "a", label: "", next: "x", chance: { base: -1 } }, {})).toBe(0.05);
    expect(choiceChance({ id: "a", label: "", next: "x", chance: { base: 0.5, skill: "music", perLevel: 0.1 } }, { music: 2 })).toBeCloseTo(0.7);
  });
});

describe("treasure", () => {
  it("every spot is an anchor in its venue's layout", () => {
    for (const t of TREASURE_SPOTS) expect(LAYOUTS[t.venue]?.anchors[t.anchor], t.id).toBeDefined();
  });
  it("pays the published bands", () => {
    expect([1, 2, 3, 4, 10, 11, 50].map(treasureReward)).toEqual([5000, 2500, 2500, 1000, 1000, 300, 300]);
  });
});
