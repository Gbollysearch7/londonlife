import { GRADE_UPLIFT, IMPRESS_BACKFIRE, SHIFT, WAGE_TAX, WORK_STYLES, WORK_TASKS, type WorkStyle } from "@/content/careers";
import type { CareerDef, Needs, SkillId } from "@/content/types";

export interface StyleMark {
  style: WorkStyle;
  at: string;
}

export interface ShiftTask {
  id: string;
  /** Original option indexes in the order shown to the player. */
  order: number[];
  dueAt: string;
  expiresAt: string;
  answer: number | null;
  outcome: "success" | "ok" | "fail" | null;
}

export function seededRandom(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Picks the shift's tasks and option order deterministically from the shift id. */
export function planTasks(career: CareerDef, shiftId: string, startedAt: Date, msPerMinute: number): ShiftTask[] {
  const rand = seededRandom(`tasks:${shiftId}`);
  const pool = [...WORK_TASKS[career.tasks]];
  const picked: ShiftTask[] = [];
  for (const minute of SHIFT.taskMinutes) {
    const def = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const order = [0, 1, 2];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const due = startedAt.getTime() + minute * msPerMinute;
    picked.push({
      id: def.id,
      order,
      dueAt: new Date(due).toISOString(),
      expiresAt: new Date(due + SHIFT.taskWindowMinutes * msPerMinute).toISOString(),
      answer: null,
      outcome: null,
    });
  }
  return picked;
}

/** Hours spent in each style between start and end; the style in force at each instant counts. */
export function styleHours(marks: StyleMark[], start: Date, end: Date, msPerHour: number): Record<WorkStyle, number> {
  const out = Object.fromEntries(Object.keys(WORK_STYLES).map((k) => [k, 0])) as Record<WorkStyle, number>;
  const sorted = [...marks].sort((a, b) => a.at.localeCompare(b.at));
  for (let i = 0; i < sorted.length; i++) {
    const from = Math.max(new Date(sorted[i].at).getTime(), start.getTime());
    const to = Math.min(i + 1 < sorted.length ? new Date(sorted[i + 1].at).getTime() : end.getTime(), end.getTime());
    if (to > from) out[sorted[i].style] += (to - from) / msPerHour;
  }
  return out;
}

export interface ShiftOutcome {
  workedMinutes: number;
  full: boolean;
  paid: boolean;
  grossPence: number;
  perfDelta: number;
  needs: Partial<Needs>;
  xp: number;
  tasks: { success: number; ok: number; fail: number; missed: number };
  backfired: boolean;
}

/**
 * Settles a shift from its persisted record. `end` is the settlement instant (shift end, or an early exit).
 * Durations are in game minutes; `msPerMinute` converts real time (it shrinks under the development time scale).
 */
export function shiftOutcome(args: {
  shiftId: string;
  salaryPence: number;
  marks: StyleMark[];
  tasks: ShiftTask[];
  startedAt: Date;
  end: Date;
  msPerMinute: number;
}): ShiftOutcome {
  const { salaryPence, marks, tasks, startedAt, end, msPerMinute } = args;
  const workedMinutes = Math.min(SHIFT.minutes, Math.max(0, (end.getTime() - startedAt.getTime()) / msPerMinute));
  const full = workedMinutes >= SHIFT.minutes - 1e-6;
  const paid = workedMinutes >= SHIFT.minPaidMinutes;
  const hours = styleHours(marks, startedAt, end, msPerMinute * 60);

  let perf = 0;
  const needs = { energy: 0, fun: 0, social: 0 };
  for (const [style, h] of Object.entries(hours) as [WorkStyle, number][]) {
    const s = WORK_STYLES[style];
    perf += s.perf * h;
    needs.energy += s.energy * h;
    needs.fun += s.fun * h;
    needs.social += s.social * h;
  }
  const backfired = hours.impress > 0 && seededRandom(`impress:${args.shiftId}`)() < IMPRESS_BACKFIRE.chance;
  if (backfired) perf += IMPRESS_BACKFIRE.perf;

  const counts = { success: 0, ok: 0, fail: 0, missed: 0 };
  for (const t of tasks) {
    if (t.outcome) counts[t.outcome]++;
    else if (new Date(t.dueAt) <= end) counts.missed++;
  }
  perf += counts.success * SHIFT.taskPerf.success + counts.fail * SHIFT.taskPerf.fail;

  const base = paid ? salaryPence * (workedMinutes / SHIFT.minutes) : 0;
  const bonus = paid ? salaryPence * SHIFT.taskPayBonus * counts.success : 0;
  return {
    workedMinutes,
    full,
    paid,
    grossPence: Math.round(base + bonus),
    perfDelta: Math.round(perf),
    needs: { energy: Math.round(needs.energy), fun: Math.round(needs.fun), social: Math.round(needs.social) },
    xp: Math.round(SHIFT.xpPerShift * (workedMinutes / SHIFT.minutes)),
    tasks: counts,
    backfired,
  };
}

/** Marginal fictional wage tax given wages already earned this London week. */
export function wageTax(earnedThisWeekPence: number, grossPence: number) {
  const remainingAllowance = Math.max(0, WAGE_TAX.allowancePence - earnedThisWeekPence);
  const taxable = Math.max(0, grossPence - remainingAllowance);
  return Math.round(taxable * WAGE_TAX.rate);
}

export interface Progress {
  rank: number;
  grade: number;
  performance: number;
  shiftsAtGrade: number;
}

/**
 * Applies one settled shift. Promotion happens only after a full shift, at 100 performance,
 * with the required shifts at the current grade, and advances exactly one grade.
 */
export function applyShift(
  p: Progress,
  career: CareerDef,
  outcome: { full: boolean; perfDelta: number },
  skillLevels: Partial<Record<SkillId, number>>,
): { next: Progress; promoted: boolean; blockedBy: string | null } {
  const performance = Math.max(0, Math.min(100, p.performance + outcome.perfDelta));
  const shiftsAtGrade = p.shiftsAtGrade + (outcome.full ? 1 : 0);
  const next = { ...p, performance, shiftsAtGrade };
  const topped = p.rank === 5 && p.grade === 3;
  if (!outcome.full || topped || performance < SHIFT.promotionPerformance || shiftsAtGrade < SHIFT.shiftsPerGrade) {
    return { next, promoted: false, blockedBy: null };
  }
  const nextRank = p.grade === GRADE_UPLIFT.length ? p.rank + 1 : p.rank;
  const nextGrade = p.grade === GRADE_UPLIFT.length ? 1 : p.grade + 1;
  if (nextRank !== p.rank) {
    const gate = career.ranks[nextRank - 1].gate;
    if (gate && (skillLevels[gate.skill] ?? 0) < gate.level) {
      return { next, promoted: false, blockedBy: `${cap(gate.skill)} level ${gate.level}` };
    }
  }
  return {
    next: { rank: nextRank, grade: nextGrade, performance: SHIFT.performanceAfterPromotion, shiftsAtGrade: 0 },
    promoted: true,
    blockedBy: null,
  };
}

const cap = (s: string) => (s === "enterprise" ? "Enterprise" : s[0].toUpperCase() + s.slice(1));

/** ISO week key in London time, e.g. "2026-W41". */
export function londonWeekKey(at: Date): string {
  const d = new Date(at.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ISO weekday (1 = Monday) in London. */
export function londonWeekday(at: Date): number {
  const d = at.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" });
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}
