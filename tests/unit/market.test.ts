import { describe, expect, it } from "vitest";
import { COMPANY, SECTORS, businessTax, companyDay, companyForecast, companyLevelFor, marketFee, marketRoll, seededFraction, validCompanyName } from "@/content/market";
import { companyPeriodFor } from "@/server/company";

describe("shared economy rules", () => {
  it("takes a 5% market fee rounded to whole pence", () => {
    expect(marketFee(10_000)).toBe(500);
    expect(marketFee(150)).toBe(8);
  });

  it("taxes business profit marginally within the week, separate from wages", () => {
    expect(businessTax(0, 20_000)).toBe(0);
    expect(businessTax(0, 50_000)).toBe(5_000);
    expect(businessTax(90_000, 20_000)).toBe(2_000 + 3_000);
    expect(businessTax(0, 50_000) + businessTax(50_000, 50_000)).toBe(businessTax(0, 100_000));
    expect(businessTax(0, -500)).toBe(0);
  });

  it("seeds the market roll per period, inside each sector's range", () => {
    for (const s of SECTORS) {
      for (let i = 0; i < 50; i++) {
        const r = marketRoll(s, `co:${i}`);
        expect(r).toBeGreaterThanOrEqual(s.roll[0]);
        expect(r).toBeLessThanOrEqual(s.roll[1]);
        expect(marketRoll(s, `co:${i}`)).toBe(r);
      }
    }
    expect(seededFraction("a")).not.toBe(seededFraction("b"));
  });

  it("raises takings with work up to the counted sessions, and with level and enterprise", () => {
    const s = SECTORS[0];
    const at = (sessions: number, level = 1, enterprise = 3) => companyDay({ sector: s, level, enterprise, sessions, roll: 1 }).takings;
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(COMPANY.sessionsCounted)).toBe(at(COMPANY.sessionsCounted + 5));
    expect(at(3, 2)).toBeGreaterThan(at(3, 1));
    expect(at(3, 1, 6)).toBeGreaterThan(at(3, 1, 3));
    const f = companyForecast(s, 1, 3);
    expect(f.lowPence).toBeLessThan(f.highPence);
  });

  it("maps progress to levels and validates company names", () => {
    expect(companyLevelFor(0)).toBe(1);
    expect(companyLevelFor(80)).toBe(2);
    expect(companyLevelFor(10_000)).toBe(5);
    expect(validCompanyName("  Nightjar   Coffee ")).toBe("Nightjar Coffee");
    expect(validCompanyName("ab")).toBeNull();
    expect(validCompanyName("<script>")).toBeNull();
  });

  it("counts work before 18:00 London towards today and after it towards tomorrow (DST-safe)", () => {
    expect(companyPeriodFor(new Date("2026-10-10T16:59:00Z"))).toBe("2026-10-10"); // 17:59 BST
    expect(companyPeriodFor(new Date("2026-10-10T17:00:00Z"))).toBe("2026-10-11"); // 18:00 BST
    expect(companyPeriodFor(new Date("2026-12-01T17:59:00Z"))).toBe("2026-12-01"); // 17:59 GMT
  });
});
