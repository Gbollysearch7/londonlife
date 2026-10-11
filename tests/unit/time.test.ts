import { describe, expect, it } from "vitest";
import { londonDayKey, londonInstant, londonHour, nextLondonWeekly } from "@/sim/time";

describe("London calendar helpers", () => {
  it("builds 09:00 London in summer and winter time", () => {
    expect(londonInstant("2026-07-04", 9).toISOString()).toBe("2026-07-04T08:00:00.000Z");
    expect(londonInstant("2026-12-05", 9).toISOString()).toBe("2026-12-05T09:00:00.000Z");
  });
  it("finds the next Saturday 09:00 across the clocks going back", () => {
    // Friday 23 Oct 2026; the clocks go back on Sunday 25 Oct.
    const next = nextLondonWeekly(new Date("2026-10-23T12:00:00Z"), 6, 9);
    expect(next.toISOString()).toBe("2026-10-24T08:00:00.000Z");
    const after = nextLondonWeekly(next, 6, 9);
    expect(after.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(londonHour(after)).toBe(9);
    expect(londonDayKey(after)).toBe("2026-10-31");
  });
  it("is strictly after the given instant", () => {
    const sat = new Date("2026-10-24T08:00:00Z");
    expect(nextLondonWeekly(sat, 6, 9).toISOString()).toBe("2026-10-31T09:00:00.000Z");
  });
});
