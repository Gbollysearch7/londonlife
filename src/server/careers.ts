import crypto from "node:crypto";
import { CAREERS, GRADE_NAMES, SHIFT, WORK_STYLES, WORK_TASKS, careerDef, roleTitle, salaryPence, type WorkStyle } from "@/content/careers";
import { venue } from "@/content/world";
import type { CareerDef } from "@/content/types";
import { applyEffects } from "@/sim/needs";
import { applyShift, londonWeekKey, londonWeekday, planTasks, shiftOutcome, wageTax, type ShiftTask, type StyleMark } from "@/sim/shift";
import { durationMs, londonDayKey, londonHour } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { endGuestVisit } from "./social";
import { perkEffects } from "@/content/goals";
import { CERT_PERF_BONUS, certifiedCareers } from "./courses";
import { effectiveLevels } from "./skills";
import { addXp, emit, fmtMoney, loadCtx, moveMoney, requireCharacter, saveNeeds, type CharRow, type Ctx } from "./game";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cap = (s: string) => (s === "enterprise" ? "Enterprise" : s[0].toUpperCase() + s.slice(1));

export function workdaysText(c: CareerDef) {
  return c.workdays.length === 7 ? "Every day" : c.workdays.length === 5 && c.workdays[4] === 5 ? "Mon–Fri" : c.workdays.map((d) => DAY_NAMES[d - 1]).join(", ");
}
const hourText = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const windowText = (c: CareerDef) => `start ${hourText(c.window[0])}–${hourText(c.window[1])}`;

/** Effective (rust-adjusted) levels: the same numbers every other gate uses. */
async function skillLevels(tx: Tx, charId: string, now: Date) {
  return (await effectiveLevels(tx, charId, now)) as Record<string, number>;
}

async function progressOf(tx: Tx, charId: string) {
  const r = (await tx.query("SELECT * FROM career_progress WHERE character_id = $1", [charId])).rows[0];
  if (!r) return null;
  return {
    careerId: r.career_id as string,
    rank: Number(r.rank),
    grade: Number(r.grade),
    performance: Number(r.performance),
    shiftsAtGrade: Number(r.shifts_at_grade),
  };
}

function entryBlocker(career: CareerDef, skills: Record<string, number>) {
  if (!career.entry?.length) return null;
  if (career.entry.some((e) => (skills[e.skill] ?? 0) >= e.level)) return null;
  return `Needs ${career.entry.map((e) => `${cap(e.skill)} level ${e.level}`).join(" or ")}.`;
}

/** Why a shift can't start right now, or null. Shared by the Work panel and StartShift. */
function shiftBlocker(c: CharRow, ctx: Ctx, career: CareerDef, todayShifts: number, now: Date) {
  if (ctx.shift) return "You're already on shift.";
  if (ctx.journey) return "You're travelling.";
  if (ctx.running) return "Finish or cancel what you're doing first.";
  if (c.location !== career.workplace) return `Shifts start at ${venue(career.workplace)!.name}.`;
  if (!career.workdays.includes(londonWeekday(now))) return `${career.name} shifts run ${workdaysText(career)}.`;
  const h = londonHour(now);
  if (h < career.window[0] || h >= career.window[1]) return `Shifts ${windowText(career)}, London time.`;
  if (todayShifts > 0) return "You've already worked a shift today. Come back tomorrow.";
  if (c.needs.energy < SHIFT.minEnergy) return "Too tired to work. Rest first.";
  if (c.needs.hunger < SHIFT.minHunger) return "Too hungry to work. Eat first.";
  return null;
}

async function shiftsToday(tx: Tx, charId: string, now: Date) {
  const r = await tx.query("SELECT count(*) AS n FROM shifts WHERE character_id = $1 AND period_key = $2", [charId, londonDayKey(now)]);
  return Number(r.rows[0].n);
}

// ─────────────────────────── commands ───────────────────────────

export async function joinCareer(tx: Tx, accountId: string, p: { careerId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const career = careerDef(p.careerId);
  if (!career) throw new GameError("bad_career", "Unknown career.");
  const ctx = await loadCtx(tx, c, now);
  if (ctx.shift) throw new GameError("on_shift", "Finish or leave your shift before changing jobs.");
  const current = await progressOf(tx, c.id);
  if (current?.careerId === career.id) throw new GameError("same_career", `You already work in ${career.name}.`);
  const blocked = entryBlocker(career, await skillLevels(tx, c.id, now));
  if (blocked) throw new GameError("not_eligible", blocked);
  await tx.query(
    `INSERT INTO career_progress (character_id, career_id, rank, grade, performance, shifts_at_grade, joined_at)
     VALUES ($1, $2, 1, 1, $3, 0, $4)
     ON CONFLICT (character_id) DO UPDATE SET career_id = $2, rank = 1, grade = 1, performance = $3, shifts_at_grade = 0, joined_at = $4`,
    [c.id, career.id, SHIFT.startPerformance, now],
  );
  await emit(tx, c.id, "career_joined", { career: career.id }, now);
  return { message: `You're now a ${roleTitle(career, 1, 1)} in ${career.name}. Shifts are at ${venue(career.workplace)!.name}.` };
}

export async function startShift(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const prog = await progressOf(tx, c.id);
  if (!prog) throw new GameError("no_career", "Join a career in the Jobs app first.");
  const career = careerDef(prog.careerId)!;
  const ctx = await loadCtx(tx, c, now);
  const blocked = shiftBlocker(c, ctx, career, await shiftsToday(tx, c.id, now), now);
  if (blocked) throw new GameError("blocked", blocked);
  const id = crypto.randomUUID();
  const msPerMinute = durationMs(1);
  const salary = salaryPence(career, prog.rank, prog.grade);
  await tx.query(
    `INSERT INTO shifts (id, character_id, career_id, rank, grade, salary_pence, location, status, started_at, ends_at, period_key, week_key, styles, tasks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'running',$8,$9,$10,$11,$12,$13)`,
    [
      id,
      c.id,
      career.id,
      prog.rank,
      prog.grade,
      salary,
      c.location,
      now,
      new Date(now.getTime() + SHIFT.minutes * msPerMinute),
      londonDayKey(now),
      londonWeekKey(now),
      JSON.stringify([{ style: "steady", at: now.toISOString() }]),
      JSON.stringify(planTasks(career, id, now, msPerMinute)),
    ],
  );
  await endGuestVisit(tx, c.id, now);
  return { message: `Shift started: ${roleTitle(career, prog.rank, prog.grade)}, ${fmtMoney(salary)} for a full shift.` };
}

async function runningShift(tx: Tx, c: CharRow, now: Date) {
  const row = (await tx.query("SELECT * FROM shifts WHERE character_id = $1 AND status = 'running'", [c.id])).rows[0];
  if (!row) throw new GameError("no_shift", "You're not on shift — it may already have finished.");
  if (new Date(row.ends_at) <= now) throw new GameError("shift_over", "Your shift has just finished.");
  return row;
}

export async function setWorkStyle(tx: Tx, accountId: string, p: { style: WorkStyle }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  if (!(p.style in WORK_STYLES)) throw new GameError("bad_style", "Unknown work style.");
  const row = await runningShift(tx, c, now);
  const marks = row.styles as StyleMark[];
  if (marks[marks.length - 1].style === p.style) return { message: `Already set to ${WORK_STYLES[p.style].name.toLowerCase()}.` };
  marks.push({ style: p.style, at: now.toISOString() });
  await tx.query("UPDATE shifts SET styles = $2 WHERE id = $1", [row.id, JSON.stringify(marks)]);
  return { message: `Now: ${WORK_STYLES[p.style].name}.` };
}

export async function submitWorkTask(tx: Tx, accountId: string, p: { index: number; choice: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const row = await runningShift(tx, c, now);
  const tasks = row.tasks as ShiftTask[];
  const task = tasks[Number(p.index)];
  if (!task) throw new GameError("bad_task", "That task doesn't exist.");
  if (task.answer !== null) throw new GameError("answered", "You've already handled that one.");
  if (now < new Date(task.dueAt)) throw new GameError("not_yet", "That task hasn't come up yet.");
  if (now >= new Date(task.expiresAt)) throw new GameError("missed", "Too late — that moment has passed.");
  const choice = Number(p.choice);
  if (![0, 1, 2].includes(choice)) throw new GameError("bad_choice", "Pick one of the three options.");
  const def = WORK_TASKS[careerDef(row.career_id)!.tasks].find((d) => d.id === task.id)!;
  task.answer = choice;
  task.outcome = def.options[task.order[choice]].outcome;
  await tx.query("UPDATE shifts SET tasks = $2 WHERE id = $1", [row.id, JSON.stringify(tasks)]);
  const msg = { success: "Good call. +4% pay, +3 performance.", ok: "That works, but it won't impress anyone.", fail: "That didn't go well. −2 performance." };
  return { message: msg[task.outcome], outcome: task.outcome };
}

export async function leaveShift(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  const row = await runningShift(tx, c, now);
  const [notice] = await settleShift(tx, c, row, now, "left");
  return { message: notice };
}

// ─────────────────────────── settlement ───────────────────────────

export async function settleDueShift(tx: Tx, c: CharRow, now: Date) {
  const due = (await tx.query("SELECT * FROM shifts WHERE character_id = $1 AND status = 'running' AND ends_at <= $2", [c.id, now])).rows;
  const notices: string[] = [];
  for (const row of due) notices.push(...(await settleShift(tx, c, row, new Date(row.ends_at), "completed", now)));
  return notices;
}

async function settleShift(tx: Tx, c: CharRow, row: Record<string, any>, end: Date, status: "completed" | "left", now = end): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const claim = await tx.query("UPDATE shifts SET status = $2, settled_at = $3 WHERE id = $1 AND status = 'running' RETURNING id", [row.id, status, now]);
  if (!claim.rowCount) return [];
  const career = careerDef(row.career_id)!;
  const startedAt = new Date(row.started_at);
  const msPerMinute = (new Date(row.ends_at).getTime() - startedAt.getTime()) / SHIFT.minutes;
  const o = shiftOutcome({ shiftId: row.id, salaryPence: Number(row.salary_pence), marks: row.styles, tasks: row.tasks, startedAt, end, msPerMinute });
  // Go-Getter perk: performance gains (not losses) count 25% more.
  if (o.perfDelta > 0) {
    const cert = (await certifiedCareers(tx, c.id)).some((k) => k === career.id) ? CERT_PERF_BONUS : 1;
    o.perfDelta = Math.round(o.perfDelta * perkEffects(c.perks).workPerf * cert);
  }

  const earned = await tx.query(
    "SELECT COALESCE(SUM(gross_pence), 0) AS g FROM shifts WHERE character_id = $1 AND week_key = $2 AND id <> $3 AND settled_at IS NOT NULL",
    [c.id, row.week_key, row.id],
  );
  const tax = wageTax(Number(earned.rows[0].g), o.grossPence);
  const net = o.grossPence - tax;
  const role = roleTitle(career, Number(row.rank), Number(row.grade));

  c.needs = applyEffects(c.needs, o.needs);
  await saveNeeds(tx, c, now);
  if (net > 0) await moveMoney(tx, c, net, "wages", `${role} shift: ${fmtMoney(o.grossPence)} gross, ${fmtMoney(tax)} tax`, { type: "shift", id: row.id });
  if (o.xp > 0) await addXp(tx, c, career.skill, o.xp, now);

  const prog = await progressOf(tx, c.id);
  let promoted = false;
  let blockedBy: string | null = null;
  let newRole = role;
  if (prog && prog.careerId === career.id) {
    const r = applyShift(prog, career, o, await skillLevels(tx, c.id, now));
    promoted = r.promoted;
    blockedBy = r.blockedBy;
    newRole = roleTitle(career, r.next.rank, r.next.grade);
    await tx.query("UPDATE career_progress SET rank = $2, grade = $3, performance = $4, shifts_at_grade = $5 WHERE character_id = $1", [
      c.id,
      r.next.rank,
      r.next.grade,
      r.next.performance,
      r.next.shiftsAtGrade,
    ]);
  }
  if (o.full) await emit(tx, c.id, "shift_completed", { career: career.id }, now);
  if (promoted) await emit(tx, c.id, "promoted", { career: career.id, role: newRole }, now);

  const summary = {
    workedMinutes: Math.round(o.workedMinutes),
    full: o.full,
    gross: o.grossPence,
    tax,
    net,
    perfDelta: o.perfDelta,
    tasks: o.tasks,
    backfired: o.backfired,
    promoted,
    newRole,
    blockedBy,
  };
  await tx.query("UPDATE shifts SET gross_pence = $2, tax_pence = $3, net_pence = $4, perf_delta = $5, result = $6 WHERE id = $1", [
    row.id,
    o.grossPence,
    tax,
    net,
    o.perfDelta,
    JSON.stringify(summary),
  ]);

  const parts = [
    status === "left" ? `You left after ${Math.round(o.workedMinutes)} min` : "Shift complete",
    o.paid ? `${fmtMoney(net)} paid (${fmtMoney(o.grossPence)} gross, ${fmtMoney(tax)} tax)` : `no pay before ${SHIFT.minPaidMinutes} minutes`,
    `performance ${o.perfDelta >= 0 ? "+" : ""}${o.perfDelta}`,
  ];
  if (o.backfired) parts.push("the manager wasn't impressed (−5)");
  if (promoted) parts.push(`promoted to ${newRole}!`);
  else if (blockedBy) parts.push(`promotion needs ${blockedBy}`);
  return [`${parts.join(", ")}.`];
}

// ─────────────────────────── view ───────────────────────────

export async function careerView(tx: Tx, c: CharRow, ctx: Ctx, now: Date) {
  const skills = await skillLevels(tx, c.id, now);
  const prog = await progressOf(tx, c.id);
  const today = await shiftsToday(tx, c.id, now);
  const catalogue = CAREERS.map((k) => ({
    id: k.id,
    name: k.name,
    blurb: k.blurb,
    entryRole: roleTitle(k, 1, 1),
    payPence: salaryPence(k, 1, 1),
    topPayPence: salaryPence(k, 5, 3),
    skill: cap(k.skill),
    workplace: venue(k.workplace)!.name,
    schedule: `${workdaysText(k)}, ${windowText(k)}`,
    ladder: k.ranks.map((r) => r.title),
    current: prog?.careerId === k.id,
    reason: entryBlocker(k, skills),
  }));

  let current = null;
  if (prog) {
    const k = careerDef(prog.careerId)!;
    const topped = prog.rank === 5 && prog.grade === 3;
    const nextRank = prog.grade === 3 ? prog.rank + 1 : prog.rank;
    const nextGrade = prog.grade === 3 ? 1 : prog.grade + 1;
    const gate = !topped && nextRank !== prog.rank ? k.ranks[nextRank - 1].gate : undefined;
    const blocker = shiftBlocker(c, ctx, k, today, now);
    current = {
      careerId: k.id,
      name: k.name,
      title: roleTitle(k, prog.rank, prog.grade),
      rank: prog.rank,
      grade: GRADE_NAMES[prog.grade - 1],
      salaryPence: salaryPence(k, prog.rank, prog.grade),
      performance: prog.performance,
      shiftsAtGrade: prog.shiftsAtGrade,
      shiftsNeeded: SHIFT.shiftsPerGrade,
      next: topped
        ? null
        : {
            title: roleTitle(k, nextRank, nextGrade),
            salaryPence: salaryPence(k, nextRank, nextGrade),
            gate: gate ? { label: `${cap(gate.skill)} level ${gate.level}`, met: (skills[gate.skill] ?? 0) >= gate.level } : null,
          },
      workplace: k.workplace,
      workplaceName: venue(k.workplace)!.name,
      schedule: `${workdaysText(k)}, ${windowText(k)}`,
      skill: cap(k.skill),
      workedToday: today > 0,
      canStart: !blocker,
      reason: blocker,
    };
  }

  let shift = null;
  if (ctx.shift) {
    const row = ctx.shift as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const k = careerDef(row.career_id)!;
    const marks = row.styles as StyleMark[];
    const startedAt = new Date(row.started_at);
    const msPerMinute = (new Date(row.ends_at).getTime() - startedAt.getTime()) / SHIFT.minutes;
    const so = shiftOutcome({ shiftId: row.id, salaryPence: Number(row.salary_pence), marks, tasks: row.tasks, startedAt, end: now, msPerMinute });
    shift = {
      id: String(row.id),
      careerName: k.name,
      title: roleTitle(k, Number(row.rank), Number(row.grade)),
      salaryPence: Number(row.salary_pence),
      startedAt: startedAt.toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      minPaidAt: new Date(startedAt.getTime() + SHIFT.minPaidMinutes * msPerMinute).toISOString(),
      style: marks[marks.length - 1].style as WorkStyle,
      earnedSoFarPence: so.grossPence,
      performanceNow: Math.max(0, Math.min(100, (prog?.performance ?? 0) + so.perfDelta)),
      promotionAtStake: !!prog && prog.shiftsAtGrade + 1 >= SHIFT.shiftsPerGrade,
      tasks: (row.tasks as ShiftTask[])
        .map((t, index) => {
          const def = WORK_TASKS[k.tasks].find((d) => d.id === t.id)!;
          return {
            index,
            prompt: def.prompt,
            options: t.order.map((i) => def.options[i].text),
            dueAt: t.dueAt,
            expiresAt: t.expiresAt,
            answer: t.answer,
            outcome: t.outcome,
          };
        })
        .filter((t) => new Date(t.dueAt) <= now),
      taskCount: (row.tasks as ShiftTask[]).length,
    };
  }

  const history = (
    await tx.query("SELECT * FROM shifts WHERE character_id = $1 AND status <> 'running' ORDER BY started_at DESC LIMIT 6", [c.id])
  ).rows.map((r) => {
    const k = careerDef(r.career_id)!;
    return {
      id: String(r.id),
      day: String(r.period_key),
      title: roleTitle(k, Number(r.rank), Number(r.grade)),
      status: String(r.status),
      net: Number(r.net_pence ?? 0),
      gross: Number(r.gross_pence ?? 0),
      tax: Number(r.tax_pence ?? 0),
      perfDelta: Number(r.perf_delta ?? 0),
      promoted: !!r.result?.promoted,
    };
  });

  return { career: { current, catalogue, history, styles: WORK_STYLES }, shift };
}
