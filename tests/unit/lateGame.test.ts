import { describe, expect, it } from "vitest";
import { FORECASTS, HARDSHIP, PET_RULES, VEHICLES, forecastFor, hazardFor, petWellbeing, premiumFor, serviceCost, uninsuredShare, vehicleDef, vehicleResale } from "@/content/lateGame";
import { TRAVEL_MODES, journeyQuote, modesFor } from "@/content/world";
import { insuranceWeek } from "@/server/lateGame";

describe("late-game content", () => {
  it("keeps every vehicle within the rules: drive beats the bus, cycling beats walking", () => {
    for (const v of VEHICLES) {
      if (v.mode === "drive") expect(v.speed).toBeLessThan(TRAVEL_MODES.bus.speed);
      else expect(v.speed).toBeLessThan(TRAVEL_MODES.walk.speed);
      expect(v.colours.length).toBeGreaterThan(0);
    }
    expect(VEHICLES.map((v) => v.id)).toEqual(["bicycle", "e_scooter", "compact_car", "family_car", "electric_saloon"]);
  });

  it("only offers owned-vehicle modes when asked, and quotes with the vehicle's speed and cost", () => {
    expect(modesFor("home", "city_office")).not.toContain("cycle");
    expect(modesFor("home", "city_office", [0, 0], { cycle: true })).toContain("cycle");
    expect(modesFor("home", "city_office", [0, 0], { drive: true })).toEqual(["walk", "bus", "tube", "taxi", "drive"]);
    const saloon = vehicleDef("electric_saloon")!;
    const q = journeyQuote("home", "city_office", "drive", [0, 0], { speed: saloon.speed, tripPence: saloon.tripPence, name: "Drive" });
    expect(q.farePence).toBe(150);
    expect(q.minutes).toBe(Math.round(35 * saloon.speed));
  });

  it("resells at 60% when new and services in proportion to wear", () => {
    expect(vehicleResale(100000, 100)).toBe(60000);
    expect(vehicleResale(100000, 0)).toBe(36000);
    expect(serviceCost(vehicleDef("compact_car")!, 100)).toBe(0);
    expect(serviceCost(vehicleDef("compact_car")!, 50)).toBe(15000);
  });

  it("samples a week's forecast and each character's incident once, deterministically", () => {
    expect(forecastFor("2026-W42")).toBe(forecastFor("2026-W42"));
    const start = new Date("2026-10-10T08:00:00Z");
    const a = hazardFor("char-a", "2026-W42", start);
    expect(hazardFor("char-a", "2026-W42", start)).toEqual(a);
    let hits = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const r = hazardFor(`char-${i}`, "2026-W42", start);
      if (r) {
        hits++;
        expect(r.at.getTime()).toBeGreaterThan(start.getTime());
        expect(r.at.getTime()).toBeLessThan(start.getTime() + 7 * 86_400_000);
      }
    }
    const risk = forecastFor("2026-W42").risk;
    expect(hits / n).toBeGreaterThan(risk - 0.03);
    expect(hits / n).toBeLessThan(risk + 0.03);
  });

  it("prices premiums from the forecast", () => {
    for (const f of FORECASTS) expect(f.premiumMult).toBeGreaterThan(0);
    const k = "2026-W43";
    expect(premiumFor("home", k)).toBe(Math.round((500 * forecastFor(k).premiumMult) / 10) * 10);
  });

  it("caps uninsured losses and gives low earners hardship relief", () => {
    expect(uninsuredShare(20000, false)).toBe(HARDSHIP.uninsuredCapPence);
    expect(uninsuredShare(2000, false)).toBe(2000);
    expect(uninsuredShare(20000, true)).toBe(Math.round(HARDSHIP.uninsuredCapPence * HARDSHIP.lowIncomeShare));
  });

  it("lets pet wellbeing fall only to a floor, with an offline cap", () => {
    const t = new Date("2026-10-10T08:00:00Z");
    expect(petWellbeing(80, t, new Date(t.getTime() + 4 * 3_600_000), "cat")).toBe(70);
    expect(petWellbeing(80, t, new Date(t.getTime() + 100 * 3_600_000), "dog")).toBe(80 - PET_RULES.offlineCapHours * 3.5);
    expect(petWellbeing(30, t, new Date(t.getTime() + 8 * 3_600_000), "dog")).toBe(PET_RULES.floor);
    expect(petWellbeing(PET_RULES.floor, t, new Date(t.getTime() + 8 * 3_600_000), "dog")).toBe(PET_RULES.floor);
  });

  it("finds the insurance week (Saturday 09:00 London) across the clocks going back", () => {
    // 09:00 BST = 08:00 UTC on Saturday 24 October; 09:00 GMT = 09:00 UTC on Saturday 31 October.
    const w = insuranceWeek(new Date("2026-10-27T12:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(insuranceWeek(new Date("2026-10-31T09:00:00Z")).start.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(insuranceWeek(new Date("2026-10-31T08:59:00Z")).start.toISOString()).toBe("2026-10-24T08:00:00.000Z");
  });
});
