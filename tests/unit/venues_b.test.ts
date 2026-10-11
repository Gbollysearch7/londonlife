import { describe, expect, it } from "vitest";
import { ACTIVITIES_B, MEMBERS_GREEN_REP_LEVEL, VENUES_B } from "@/content/city_b";
import { REPUTATION_TITLES } from "@/content/balance";
import { ACTIVITIES, VENUES } from "@/content/world";
import { LAYOUTS } from "@/world/venues/layouts";
import { visualFor } from "@/world/activityVisuals";

const core = (venueId: string) => ACTIVITIES_B.filter((a) => a.location === venueId && !a.id.startsWith("chat_") && a.event !== "toilet");

describe("venues part B content", () => {
  it("adds nine venues, all wired into the world lists with unique ids", () => {
    expect(VENUES_B).toHaveLength(9);
    for (const v of VENUES_B) expect(VENUES.filter((x) => x.id === v.id)).toHaveLength(1);
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACTIVITIES_B) expect(ACTIVITIES).toContain(a);
  });

  it("each venue has an NPC, toilets, opening hours, a map spot and distinct things to do", () => {
    for (const v of VENUES_B) {
      expect(v.npcs.length, v.id).toBeGreaterThan(0);
      expect(v.npcs.every((n) => /NPC/.test(n.role))).toBe(true);
      expect(ACTIVITIES_B.some((a) => a.location === v.id && a.event === "toilet"), `${v.id} toilets`).toBe(true);
      expect(v.hours, v.id).toBeDefined();
      expect(v.map, v.id).toBeDefined();
      const n = core(v.id).length;
      // The justice hall is deliberately limited to a tour and a reading room until court cases exist.
      expect(n, v.id).toBeGreaterThanOrEqual(v.id === "justice_hall" ? 2 : 4);
      expect(n, v.id).toBeLessThanOrEqual(7);
      expect(new Set(core(v.id).map((a) => a.label)).size).toBe(n);
    }
  });

  it("map spots don't sit on top of another venue", () => {
    for (const v of VENUES_B) {
      for (const o of VENUES.filter((x) => x.id !== v.id && x.kind === "venue" && x.map)) {
        expect(Math.hypot(v.map![0] - o.map![0], v.map![1] - o.map![1]), `${v.id} vs ${o.id}`).toBeGreaterThan(0.25);
      }
    }
  });

  it("never fakes systems owned by other workstreams", () => {
    const text = (id: string) => ACTIVITIES_B.filter((a) => a.location === id).map((a) => `${a.id} ${a.label} ${a.event}`).join(" ").toLowerCase();
    expect(text("city_hall")).not.toMatch(/vote|ballot|elect/);
    expect(ACTIVITIES_B.some((a) => a.anchor === "ballot")).toBe(false);
    expect(LAYOUTS.city_hall.anchors.ballot.label).toBeTruthy();
    expect(LAYOUTS.city_hall.anchors.lobby.label).toBeTruthy();
    expect(text("air_terminal")).not.toMatch(/flight|fly|board|depart/);
    expect(core("justice_hall").map((a) => a.id).sort()).toEqual(["courts_tour", "law_library_reading"]);
    expect(ACTIVITIES_B.every((a) => a.event !== "journey_arrived")).toBe(true);
    // Room rest is an activity at the hotel, not a home: it never requires home furniture.
    expect(ACTIVITIES_B.find((a) => a.id === "hotel_room_rest")!.requires).toBeUndefined();
  });

  it("the members' gate is visible and the public range has no gate", () => {
    expect(REPUTATION_TITLES[MEMBERS_GREEN_REP_LEVEL - 1].title).toBe("Borough Favourite");
    const green = ACTIVITIES_B.filter((a) => a.location === "members_green");
    expect(green.filter((a) => a.repGate).map((a) => a.id).sort()).toEqual(["clubhouse_lunch", "golf_round", "members_network"]);
    for (const id of ["range_bucket", "golf_lesson", "range_tea"]) expect(green.find((a) => a.id === id)!.repGate).toBeUndefined();
    expect(VENUES_B.find((v) => v.id === "members_green")!.access).toMatch(/Borough Favourite/);
  });

  it("balance stays on the spec scale", () => {
    for (const a of ACTIVITIES_B) {
      if (a.xp && a.minutes >= 10) expect(a.xp.amount / a.minutes, a.id).toBeLessThanOrEqual(3.2);
      if (a.payPence) expect(a.payPence / a.minutes, a.id).toBeLessThanOrEqual(400);
      expect(a.costPence, a.id).toBeLessThanOrEqual(5000);
      if (a.payPence) expect(a.dailyLimit, `${a.id} needs a daily cap`).toBeDefined();
    }
  });

  it("every activity has its own visual", () => {
    for (const a of core("borough_stadium").concat(...VENUES_B.map((v) => core(v.id)))) {
      expect(visualFor(a.id), a.id).not.toEqual({ pose: "work" });
    }
  });
});
