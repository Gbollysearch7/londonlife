import { describe, expect, it } from "vitest";
import { CAREERS, careerDef, salaryPence, SHIFT } from "@/content/careers";
import { applyShift, londonWeekKey, londonWeekday, planTasks, shiftOutcome, styleHours, wageTax } from "@/sim/shift";

const MIN = 60_000;
const start = new Date("2026-10-12T09:00:00Z");
const at = (m: number) => new Date(start.getTime() + m * MIN);

describe("career content", () => {
  it("every career has five ranks, tasks and sensible pay", () => {
    for (const c of CAREERS) {
      expect(c.ranks).toHaveLength(5);
      expect(salaryPence(c, 1, 1)).toBeGreaterThan(10000);
      expect(salaryPence(c, 5, 3)).toBeGreaterThan(salaryPence(c, 1, 1) * 5);
    }
    expect(salaryPence(careerDef("kitchen")!, 1, 1)).toBe(12000);
    expect(salaryPence(careerDef("kitchen")!, 1, 2)).toBe(12600);
  });
});

describe("shift settlement", () => {
  it("integrates time spent in each style", () => {
    const h = styleHours([{ style: "steady", at: at(0).toISOString() }, { style: "hard", at: at(30).toISOString() }], start, at(60), 60 * MIN);
    expect(h.steady).toBeCloseTo(0.5);
    expect(h.hard).toBeCloseTo(0.5);
  });

  it("pays nothing below six minutes and prorates above", () => {
    const tasks = planTasks(careerDef("kitchen")!, "s1", start, MIN);
    const marks = [{ style: "steady" as const, at: start.toISOString() }];
    expect(shiftOutcome({ shiftId: "s1", salaryPence: 12000, marks, tasks, startedAt: start, end: at(5), msPerMinute: MIN }).grossPence).toBe(0);
    const half = shiftOutcome({ shiftId: "s1", salaryPence: 12000, marks, tasks, startedAt: start, end: at(30), msPerMinute: MIN });
    expect(half.grossPence).toBe(6000);
    expect(half.full).toBe(false);
    expect(half.tasks.missed).toBe(2);
  });

  it("rewards answered tasks once each", () => {
    const tasks = planTasks(careerDef("tech")!, "s2", start, MIN).map((t) => ({ ...t, answer: 0, outcome: "success" as const }));
    const o = shiftOutcome({ shiftId: "s2", salaryPence: 10000, marks: [{ style: "easy", at: start.toISOString() }], tasks, startedAt: start, end: at(60), msPerMinute: MIN });
    expect(o.full).toBe(true);
    expect(o.grossPence).toBe(10000 + 4 * 400);
    expect(o.perfDelta).toBe(3 + 12);
  });

  it("plans the same tasks for the same shift and never repeats a task", () => {
    const a = planTasks(careerDef("banking")!, "same", start, MIN);
    expect(a).toEqual(planTasks(careerDef("banking")!, "same", start, MIN));
    expect(new Set(a.map((t) => t.id)).size).toBe(SHIFT.taskMinutes.length);
  });
});

describe("tax and promotion", () => {
  it("taxes only wages above the weekly allowance", () => {
    expect(wageTax(0, 12000)).toBe(0);
    expect(wageTax(35000, 12000)).toBe(1400);
    expect(wageTax(50000, 12000)).toBe(2400);
  });

  it("promotes one grade after two full shifts at 100 performance", () => {
    const c = careerDef("kitchen")!;
    let r = applyShift({ rank: 1, grade: 1, performance: 95, shiftsAtGrade: 0 }, c, { full: true, perfDelta: 10 }, {});
    expect(r.promoted).toBe(false);
    r = applyShift(r.next, c, { full: true, perfDelta: 10 }, {});
    expect(r.promoted).toBe(true);
    expect(r.next).toEqual({ rank: 1, grade: 2, performance: 60, shiftsAtGrade: 0 });
  });

  it("never promotes after an early exit, and respects rank gates", () => {
    const c = careerDef("kitchen")!;
    expect(applyShift({ rank: 1, grade: 1, performance: 100, shiftsAtGrade: 5 }, c, { full: false, perfDelta: 5 }, {}).promoted).toBe(false);
    const gated = applyShift({ rank: 1, grade: 3, performance: 100, shiftsAtGrade: 1 }, c, { full: true, perfDelta: 5 }, { cooking: 1 });
    expect(gated.promoted).toBe(false);
    expect(gated.blockedBy).toBe("Cooking level 2");
    expect(applyShift({ rank: 1, grade: 3, performance: 100, shiftsAtGrade: 1 }, c, { full: true, perfDelta: 5 }, { cooking: 2 }).next.rank).toBe(2);
  });

  it("uses London weeks and weekdays", () => {
    expect(londonWeekday(new Date("2026-10-10T12:00:00Z"))).toBe(6);
    expect(londonWeekKey(new Date("2026-10-12T00:30:00Z"))).toBe(londonWeekKey(new Date("2026-10-18T22:00:00Z")));
    expect(londonWeekKey(new Date("2026-10-11T22:00:00Z"))).not.toBe(londonWeekKey(new Date("2026-10-12T00:30:00Z")));
  });
});
