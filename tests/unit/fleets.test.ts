import { describe, expect, it } from "vitest";
import {
  AD_RULES,
  AD_SITES,
  FIRM,
  FIRM_LEVELS,
  TIERS,
  adPrice,
  boardFor,
  cargoOf,
  contractFuel,
  contractWear,
  dailyContractLimit,
  firmLevelFor,
  firmName,
  siteDown,
} from "@/content/fleets";
import { venue } from "@/content/world";
import { adWeek } from "@/server/fleets";

describe("courier board", () => {
  it("is fixed by the London day and differs between days", () => {
    expect(boardFor("2026-10-10")).toEqual(boardFor("2026-10-10"));
    expect(boardFor("2026-10-10")).not.toEqual(boardFor("2026-10-11"));
  });

  it("lists real, distinct places with sane times, fees and deadlines", () => {
    for (let d = 1; d <= 28; d++) {
      const day = `2026-11-${String(d).padStart(2, "0")}`;
      const board = boardFor(day);
      expect(board).toHaveLength(FIRM.boardSize);
      for (const l of board) {
        expect(venue(l.pickup)).toBeDefined();
        expect(venue(l.dropoff)).toBeDefined();
        expect(l.pickup).not.toBe(l.dropoff);
        expect([l.pickup, l.dropoff]).not.toContain("home");
        expect(l.minutes).toBeGreaterThanOrEqual(FIRM.minMinutes);
        expect(l.minutes).toBeLessThanOrEqual(FIRM.maxMinutes);
        expect(l.payPence).toBeGreaterThan(l.driverPence + contractFuel(400, l.minutes));
        expect(l.payPence % 10).toBe(0);
        expect(l.deadlineHour).toBeGreaterThanOrEqual(13);
        expect(l.deadlineHour).toBeLessThanOrEqual(23);
      }
      // Something on every board is open to a brand-new firm.
      expect(board.some((l) => TIERS[l.tier].minLevel === 1)).toBe(true);
    }
  });

  it("pays more for harder tiers on the same run length", () => {
    const fee = (t: keyof typeof TIERS) => TIERS[t].basePence + TIERS[t].perMinutePence * 30;
    expect(fee("parcel")).toBeLessThan(fee("priority"));
    expect(fee("priority")).toBeLessThan(fee("haulage"));
    expect(fee("haulage")).toBeLessThan(fee("specialist"));
  });
});

describe("courier rules", () => {
  it("scales the daily limit with cars (capped) and level", () => {
    expect(dailyContractLimit(0, 4)).toBe(0);
    expect(dailyContractLimit(1, 1)).toBe(FIRM.contractsPerCar);
    expect(dailyContractLimit(3, 1)).toBe(3 * FIRM.contractsPerCar);
    expect(dailyContractLimit(99, 1)).toBe(FIRM.maxCarsCounted * FIRM.contractsPerCar);
    expect(dailyContractLimit(2, 3)).toBe(2 * FIRM.contractsPerCar + 2);
  });

  it("levels from XP thresholds", () => {
    expect(firmLevelFor(0)).toBe(1);
    expect(firmLevelFor(FIRM_LEVELS[1] - 1)).toBe(1);
    expect(firmLevelFor(FIRM_LEVELS[1])).toBe(2);
    expect(firmLevelFor(10_000)).toBe(FIRM_LEVELS.length);
  });

  it("charges fuel per started quarter hour and wear per started 20 minutes", () => {
    expect(contractFuel(300, 15)).toBe(300);
    expect(contractFuel(300, 16)).toBe(600);
    expect(contractFuel(0, 60)).toBe(0);
    expect(contractWear(2, 20, "parcel")).toBe(2);
    expect(contractWear(2, 21, "haulage")).toBe(4 + TIERS.haulage.extraWear);
  });

  it("builds firm names only from the preset lists", () => {
    expect(firmName("Swift", "Couriers")).toBe("Swift Couriers");
    expect(firmName("Swift", "Couriers<script>")).toBeNull();
    expect(firmName("Anything I like", "Couriers")).toBeNull();
    expect(firmName(undefined, undefined)).toBeNull();
  });

  it("knows which cars have room for heavy loads", () => {
    expect(cargoOf("compact_car")).toBe(1);
    expect(cargoOf("family_car")).toBe(2);
    expect(cargoOf("electric_saloon")).toBe(2);
  });
});

describe("advertising rules", () => {
  it("runs Monday 00:00 to Monday 00:00 London, across the clocks changing", () => {
    // Saturday 10 Oct 2026 (BST): week began Monday 5 Oct 00:00 BST = Sunday 23:00 UTC.
    const w = adWeek(new Date("2026-10-10T09:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-10-04T23:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-11T23:00:00.000Z");
    // The week the clocks go back (Sunday 25 Oct) ends at Monday 00:00 GMT.
    const dst = adWeek(new Date("2026-10-24T12:00:00Z"));
    expect(dst.start.toISOString()).toBe("2026-10-18T23:00:00.000Z");
    expect(dst.end.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    // The boundary instant belongs to the new week.
    expect(adWeek(w.end).start.toISOString()).toBe(w.end.toISOString());
    expect(adWeek(w.end).key).not.toBe(w.key);
  });

  it("prorates the current week by whole days left, never below one day", () => {
    const site = AD_SITES[0];
    expect(adPrice(site, 7 * 86_400_000)).toBe(site.pricePence);
    expect(adPrice(site, 60_000)).toBe(Math.round(site.pricePence / 7 / 10) * 10);
    expect(adPrice(site, 2.5 * 86_400_000)).toBe(Math.round((site.pricePence * 3) / 7 / 10) * 10);
  });

  it("decides site downtime once per site and week, rarely", () => {
    expect(siteDown("south_bank", "2026-W50")).toBe(siteDown("south_bank", "2026-W50"));
    let down = 0;
    let total = 0;
    for (const s of AD_SITES) {
      for (let w = 1; w <= 52; w++) {
        total++;
        if (siteDown(s.id, `2027-W${String(w).padStart(2, "0")}`)) down++;
      }
    }
    expect(down).toBeGreaterThan(0);
    expect(down / total).toBeLessThan(AD_RULES.downChance * 2.5);
  });
});

describe("billboards in the world", () => {
  it("places every advertising site somewhere visible, and only on real sites", async () => {
    const { BILLBOARD_SPOTS } = await import("@/world/billboardSpots");
    const { LAYOUTS } = await import("@/world/venues/layouts");
    for (const site of AD_SITES) {
      expect(BILLBOARD_SPOTS[site.where]?.some((s) => s.site === site.id), site.id).toBe(true);
      if (site.where !== "street") expect(LAYOUTS[site.where], site.where).toBeDefined();
    }
    for (const [where, spots] of Object.entries(BILLBOARD_SPOTS)) {
      for (const s of spots) expect(AD_SITES.find((x) => x.id === s.site)?.where).toBe(where);
    }
  });

  it("keeps free-standing boards outside the walkable floor of their venue", async () => {
    const { BILLBOARD_SPOTS } = await import("@/world/billboardSpots");
    const { LAYOUTS } = await import("@/world/venues/layouts");
    for (const [where, spots] of Object.entries(BILLBOARD_SPOTS)) {
      if (where === "street") continue;
      const [w, d] = LAYOUTS[where].shell.size;
      for (const s of spots) {
        if (s.mount === "wall") continue;
        const outside = Math.abs(s.pos[0]) > w / 2 - 0.2 || Math.abs(s.pos[2]) > d / 2 - 0.2;
        expect(outside, where).toBe(true);
      }
    }
  });
});
