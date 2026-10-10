import { describe, expect, it } from "vitest";
import { settleNeeds, decayRates } from "@/sim/needs";
import { footprint, placementError } from "@/sim/placement";
import { levelForXp, computeMood, weatherFor, xpWithTraits } from "@/sim/progression";
import { assignMissions, layoutStarterHome, missionProgress, pickOrigin, swapMission } from "@/sim/setup";
import { londonDayKey } from "@/sim/time";
import { MISSIONS } from "@/content/world";
import { ORIGINS } from "@/content/character";

const full = { hunger: 80, energy: 80, fun: 80, social: 80, hygiene: 80, bladder: 80 };
const old = new Date("2026-01-01T00:00:00Z");

describe("needs settlement", () => {
  it("applies baseline decay per hour", () => {
    const r = settleNeeds({ needs: full, settledAt: new Date("2026-03-01T10:00:00Z"), now: new Date("2026-03-01T12:00:00Z"), traits: [], createdAt: old });
    expect(r.needs.hunger).toBeCloseTo(68);
    expect(r.needs.bladder).toBeCloseTo(64);
    expect(r.needs.social).toBeCloseTo(76);
  });
  it("caps offline time at eight hours and clamps at zero", () => {
    const r = settleNeeds({ needs: full, settledAt: new Date("2026-03-01T00:00:00Z"), now: new Date("2026-03-03T00:00:00Z"), traits: [], createdAt: old });
    expect(r.capped).toBe(true);
    expect(r.appliedHours).toBe(8);
    expect(r.needs.bladder).toBe(16);
    expect(r.needs.hunger).toBe(32);
  });
  it("protects newcomers with a floor during the first day", () => {
    const created = new Date("2026-03-01T00:00:00Z");
    const r = settleNeeds({ needs: full, settledAt: created, now: new Date("2026-03-01T08:00:00Z"), traits: [], createdAt: created });
    expect(r.needs.bladder).toBe(25);
  });
  it("applies trait multipliers to rates once", () => {
    expect(decayRates(["foodie"]).hunger).toBeCloseTo(6.6);
    expect(decayRates(["tidy", "easygoing"]).fun).toBeCloseTo(3 * 1.1 * 0.8);
  });
  it("settling the same interval twice in sequence never double-decays", () => {
    const a = settleNeeds({ needs: full, settledAt: new Date("2026-03-01T10:00:00Z"), now: new Date("2026-03-01T11:00:00Z"), traits: [], createdAt: old });
    const b = settleNeeds({ needs: a.needs, settledAt: new Date("2026-03-01T11:00:00Z"), now: new Date("2026-03-01T11:00:00Z"), traits: [], createdAt: old });
    expect(b.needs).toEqual(a.needs);
  });
});

describe("placement", () => {
  it("swaps footprint on rotation", () => {
    expect(footprint("sofa", 0)).toMatchObject({ w: 2, d: 1 });
    expect(footprint("sofa", 90)).toMatchObject({ w: 1, d: 2 });
  });
  it("detects collisions using the rotated footprint", () => {
    const others = [{ id: "a", defId: "single_bed", x: 0, y: 0, rot: 0 }];
    expect(placementError({ id: "b", defId: "sofa", x: 0, y: 1, rot: 0 }, others, 6, 6)).toMatch(/Blocked/);
    expect(placementError({ id: "b", defId: "sofa", x: 1, y: 0, rot: 90 }, others, 6, 6)).toBeNull();
  });
  it("keeps items inside the room", () => {
    expect(placementError({ id: "b", defId: "sofa", x: 5, y: 0, rot: 0 }, [], 6, 6)).toMatch(/fit/);
  });
  it("rugs sit under furniture but not under other rugs", () => {
    const others = [{ id: "a", defId: "sofa", x: 2, y: 3, rot: 0 }];
    expect(placementError({ id: "r", defId: "rug", x: 2, y: 3, rot: 0 }, others, 6, 6)).toBeNull();
    expect(placementError({ id: "r2", defId: "rug", x: 3, y: 3, rot: 0 }, [...others, { id: "r", defId: "rug", x: 2, y: 3, rot: 0 }], 6, 6)).toMatch(/Blocked/);
  });
  it("wall items must hang on a wall", () => {
    expect(placementError({ id: "p", defId: "poster", x: 2, y: 2, rot: 0 }, [], 6, 6)).toMatch(/wall/);
    expect(placementError({ id: "p", defId: "poster", x: 2, y: 0, rot: 0 }, [], 6, 6)).toBeNull();
    expect(placementError({ id: "p", defId: "poster", x: 0, y: 3, rot: 90 }, [], 6, 6)).toBeNull();
  });
  it("lays out every starter origin without losing items", () => {
    for (const o of ORIGINS) {
      const tier = { student_hall: 6, shared_room: 6, outer_studio: 7, one_bed: 8 }[o.homeTier]!;
      const layout = layoutStarterHome(o.furniture, tier, tier);
      expect(layout.every((l) => l.spot !== null), o.id).toBe(true);
    }
  });
});

describe("progression", () => {
  it("maps XP to levels", () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(99)).toBe(0);
    expect(levelForXp(100)).toBe(1);
    expect(levelForXp(4200)).toBe(10);
  });
  it("applies XP trait multipliers", () => {
    expect(xpWithTraits("cooking", 20, ["foodie"])).toBe(25);
    expect(xpWithTraits("cooking", 20, ["techie"])).toBe(20);
  });
  it("counts duplicate decor once and caps it", () => {
    const w = { moodDelta: 0, label: "x" };
    const one = computeMood(full, ["plant"], w).score;
    const many = computeMood(full, ["plant", "plant", "plant"], w).score;
    expect(many).toBe(one);
    const capped = computeMood(full, ["plant", "rug", "poster", "lamp", "wall_clock", "storage_chest"], w);
    expect(capped.factors.find((f) => f.label === "Home décor")!.value).toBe(6);
  });
  it("weather is deterministic per day", () => {
    expect(weatherFor("2026-10-10")).toEqual(weatherFor("2026-10-10"));
  });
});

describe("origins and missions", () => {
  it("picks origins by weight across the whole range", () => {
    expect(pickOrigin(0).id).toBe(ORIGINS[0].id);
    expect(pickOrigin(0.9999).id).toBe(ORIGINS[ORIGINS.length - 1].id);
  });
  it("assigns one mission per pool deterministically", () => {
    const a = assignMissions("c1", "2026-10-10");
    expect(a).toEqual(assignMissions("c1", "2026-10-10"));
    expect(a.map((id) => MISSIONS.find((m) => m.id === id)!.pool)).toEqual(["Easy", "Explore", "Enterprise"]);
  });
  it("swap stays in the same pool and avoids duplicates", () => {
    const a = ["cook_once", "bus_twice", "buy_furniture"];
    const r = swapMission(a, "bus_twice")!;
    expect(MISSIONS.find((m) => m.id === r)!.pool).toBe("Explore");
    expect(a).not.toContain(r);
  });
  it("progress matches event filters", () => {
    const bus = MISSIONS.find((m) => m.id === "bus_twice")!;
    expect(missionProgress(bus, [{ type: "journey_arrived", data: { mode: "walk" } }, { type: "journey_arrived", data: { mode: "bus" } }])).toBe(1);
  });
  it("uses the Europe/London calendar across midnight BST", () => {
    expect(londonDayKey(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(londonDayKey(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});
