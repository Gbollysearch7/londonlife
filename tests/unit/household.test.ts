import { describe, expect, it } from "vitest";
import { RUST, rustInfo } from "@/sim/rust";
import { activeOutage, outageForWeek } from "@/sim/outage";
import { OUTAGE, UTILITIES_PENCE, STAFF } from "@/content/household";
import { HOME_TIERS } from "@/content/character";
import { proratedWage } from "@/server/household";

const NOW = new Date("2026-10-10T12:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const CREATED = ago(1000);

describe("skill rust", () => {
  const lvl5 = { xp: 1000, bestLevel: 5 };
  it("has a seven-day grace, then loses one level per twenty idle days", () => {
    expect(rustInfo({ ...lvl5, lastUsedAt: ago(0) }, NOW, CREATED).effective).toBe(5);
    expect(rustInfo({ ...lvl5, lastUsedAt: ago(7) }, NOW, CREATED).effective).toBe(5);
    expect(rustInfo({ ...lvl5, lastUsedAt: ago(26.9) }, NOW, CREATED).effective).toBe(5);
    expect(rustInfo({ ...lvl5, lastUsedAt: ago(27) }, NOW, CREATED).effective).toBe(4);
    expect(rustInfo({ ...lvl5, lastUsedAt: ago(47) }, NOW, CREATED).effective).toBe(3);
  });

  it("never drops more than two below the best, nor below zero, and keeps XP", () => {
    const r = rustInfo({ ...lvl5, lastUsedAt: ago(5000) }, NOW, CREATED);
    expect(r.effective).toBe(5 - RUST.maxDrop);
    expect(r.level).toBe(5);
    expect(r.nextDropAt).toBeNull();
    expect(rustInfo({ xp: 100, bestLevel: 1, lastUsedAt: ago(5000) }, NOW, CREATED).effective).toBe(0);
    expect(rustInfo({ xp: 0, bestLevel: 0, lastUsedAt: null }, NOW, CREATED).effective).toBe(0);
  });

  it("uses the creation time for head-start levels that were never practised", () => {
    expect(rustInfo({ xp: 100, bestLevel: 1, lastUsedAt: null }, NOW, ago(3)).effective).toBe(1);
    expect(rustInfo({ xp: 100, bestLevel: 1, lastUsedAt: null }, NOW, ago(30)).effective).toBe(0);
  });

  it("says when the next level of rust sets in", () => {
    const r = rustInfo({ ...lvl5, lastUsedAt: ago(10) }, NOW, CREATED);
    expect(new Date(r.nextDropAt!).getTime()).toBe(ago(10).getTime() + 27 * 86_400_000);
  });
});

describe("outages", () => {
  it("are deterministic per character and week, at most one a week, within the stated hours", () => {
    let weeks = 0;
    for (let w = 1; w <= 52; w++) {
      const key = `2026-W${String(w).padStart(2, "0")}`;
      const a = outageForWeek("char-a", key);
      expect(outageForWeek("char-a", key)).toEqual(a);
      if (!a) continue;
      weeks++;
      expect(a.startHour).toBeGreaterThanOrEqual(OUTAGE.startHours[0]);
      expect(a.endHour).toBeLessThanOrEqual(OUTAGE.startHours[1] + OUTAGE.hours);
      expect(a.weekday).toBeGreaterThanOrEqual(1);
      expect(a.weekday).toBeLessThanOrEqual(7);
    }
    expect(weeks).toBeGreaterThan(10);
    expect(weeks).toBeLessThan(52);
  });

  it("are active for exactly the stated hours", () => {
    let activeHours = 0;
    for (let h = 0; h < 24 * 7; h++) if (activeOutage("char-b", new Date(Date.UTC(2026, 9, 12, h)))) activeHours++;
    expect([0, OUTAGE.hours]).toContain(activeHours);
  });
});

describe("household tables", () => {
  it("prices utilities for every home tier and rises with size", () => {
    let last = 0;
    for (const t of HOME_TIERS) {
      expect(UTILITIES_PENCE[t.id]).toBeGreaterThan(last);
      last = UTILITIES_PENCE[t.id];
    }
  });

  it("prorates first wages to the next bill time and never above a week", () => {
    const wage = STAFF[0].wagePence;
    const due = new Date(NOW.getTime() + 3.5 * 86_400_000);
    expect(proratedWage(wage, NOW, due)).toBe(Math.ceil(wage / 2));
    expect(proratedWage(wage, NOW, new Date(NOW.getTime() + 30 * 86_400_000))).toBe(wage);
    expect(proratedWage(wage, NOW, NOW)).toBe(0);
  });
});
