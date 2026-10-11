import { describe, expect, it } from "vitest";
import { HOME_TIERS } from "@/content/character";
import {
  INVESTMENT_HOMES,
  PLOTS,
  PROPERTY_RULES,
  STAGE_NAMES,
  homeValuation,
  investmentDef,
  occupiedWeek,
  plotValuation,
  saleProceeds,
  valuationFactor,
  valuationKeys,
  valuationWeek,
} from "@/content/property";

const WEEK = 7 * 86_400_000;
const T0 = new Date("2026-10-10T09:00:00Z");

describe("property content", () => {
  it("keeps investment prices separate from every residential price", () => {
    const residential = new Set(HOME_TIERS.flatMap((t) => [t.pricePence, t.rentPence]).filter(Boolean));
    for (const h of INVESTMENT_HOMES) {
      expect(residential.has(h.pricePence)).toBe(false);
      expect(residential.has(h.rentPence)).toBe(false);
      expect(HOME_TIERS.map((t) => t.id)).not.toContain(h.id);
    }
  });

  it("has caps of five homes and twenty plots, and four ordered build stages", () => {
    expect(PROPERTY_RULES.maxHomes).toBe(5);
    expect(PROPERTY_RULES.maxPlots).toBe(20);
    expect(STAGE_NAMES).toEqual(["Foundations", "Frame", "Roof", "Fit-out"]);
    for (const p of PLOTS) {
      expect(p.stages).toHaveLength(4);
      expect(investmentDef(p.buildsId)?.buildOnly).toBe(true);
      for (const s of p.stages) expect(s.costPence > 0 && s.minutes > 0).toBe(true);
    }
  });

  it("makes every home's rent cover its upkeep, with a payback of years of game weeks", () => {
    for (const h of INVESTMENT_HOMES) {
      expect(h.rentPence).toBeGreaterThan(h.maintenancePence);
      const weeklyNet = h.rentPence * (1 - h.vacancy) - h.maintenancePence;
      expect(h.pricePence / weeklyNet).toBeGreaterThan(60);
    }
  });
});

describe("valuation drift", () => {
  it("is deterministic, bounded, and moves at most a few percent a week", () => {
    let prev = valuationFactor("home:Camden", new Date("2026-01-01T00:00:00Z"));
    expect(prev).toBe(1);
    for (let w = 1; w < 600; w++) {
      const at = new Date(Date.UTC(2026, 0, 3, 9) + w * WEEK + 3600_000);
      const f = valuationFactor("home:Camden", at);
      expect(f).toBeGreaterThanOrEqual(PROPERTY_RULES.minFactor);
      expect(f).toBeLessThanOrEqual(PROPERTY_RULES.maxFactor);
      expect(Math.abs(f / prev - 1)).toBeLessThanOrEqual(PROPERTY_RULES.maxStep + 0.0031);
      expect(valuationFactor("home:Camden", at)).toBe(f);
      prev = f;
    }
  });

  it("is fixed within a week and differs between districts", () => {
    const a = homeValuation(INVESTMENT_HOMES[0], T0);
    const midweek = new Date(T0.getTime() + 3 * 86_400_000);
    expect(valuationWeek(midweek)).toBe(valuationWeek(T0));
    expect(homeValuation(INVESTMENT_HOMES[0], midweek)).toBe(a);
    const factors = new Set(["Camden", "Brixton", "Shoreditch", "Greenwich", "South Bank"].map((d) => valuationFactor(`home:${d}`, T0)));
    expect(factors.size).toBeGreaterThan(1);
    expect(a % 100).toBe(0);
    expect(plotValuation(PLOTS[0], T0) % 100).toBe(0);
  });

  it("takes a 5% fee on sale and exposes keyed valuations for SQL", () => {
    expect(saleProceeds(1_000_000)).toBe(950_000);
    const keys = valuationKeys(T0);
    expect(keys["inv:inv_camden_studio"]).toBe(homeValuation(investmentDef("inv_camden_studio")!, T0));
    expect(keys[`plot:${PLOTS[0].id}`]).toBe(plotValuation(PLOTS[0], T0));
  });
});

describe("occupancy", () => {
  it("has vacancies at roughly the catalogue rate, fixed per property and week", () => {
    const def = investmentDef("inv_shoreditch_loft")!;
    let vacant = 0;
    for (let i = 0; i < 2000; i++) if (!occupiedWeek(`prop-${i % 50}`, `2027-W${String((i % 40) + 1).padStart(2, "0")}`, def)) vacant++;
    expect(vacant / 2000).toBeGreaterThan(def.vacancy - 0.05);
    expect(vacant / 2000).toBeLessThan(def.vacancy + 0.05);
    expect(occupiedWeek("x", "2027-W05", def)).toBe(occupiedWeek("x", "2027-W05", def));
  });
});
