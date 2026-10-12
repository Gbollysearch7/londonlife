import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { cmd, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Monday 12 October 2026, 10:00 London (BST).
const MON = new Date("2026-10-12T09:00:00Z");
const SAT = new Date("2026-10-10T09:00:00Z");

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function atOffice(acc: string, t: Date) {
  await cmd(acc, "StartJourney", { destination: "city_office", mode: "tube" }, t);
  const arrive = minutes(t, 12);
  expect((await state(acc, arrive)).character.location).toBe("city_office");
  return arrive;
}

describe("D · careers and shifts", () => {
  it("enforces entry gates and where shifts happen", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, MON);
    await expect(cmd(acc, "JoinCareer", { careerId: "product" }, MON)).rejects.toThrow(/Coding level 3/);
    await expect(cmd(acc, "StartShift", {}, MON)).rejects.toThrow(/Join a career/);
    await cmd(acc, "JoinCareer", { careerId: "tech" }, MON);
    await expect(cmd(acc, "StartShift", {}, MON)).rejects.toThrow(/Shifts start at The City Office/);
    expect((await state(acc, MON)).career.current.title).toBe("Intern I");
  });

  it("only runs office shifts on weekdays", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, SAT);
    await cmd(acc, "JoinCareer", { careerId: "banking" }, SAT);
    const t = await atOffice(acc, SAT);
    await expect(cmd(acc, "StartShift", {}, t)).rejects.toThrow(/Mon–Fri/);
  });

  it("runs a full shift: styles over time, tasks once, pay, XP and one shift a day", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, MON);
    await cmd(acc, "JoinCareer", { careerId: "tech" }, MON);
    const t0 = await atOffice(acc, MON);
    const cash0 = (await state(acc, t0)).wallet.cashPence;
    await cmd(acc, "StartShift", {}, t0);
    await expect(cmd(acc, "StartShift", {}, t0)).rejects.toThrow(/already on shift/);
    await expect(cmd(acc, "StartActivity", { activityId: "office_coffee" }, t0)).rejects.toThrow(/on shift/);
    await expect(cmd(acc, "StartJourney", { destination: "home", mode: "walk" }, t0)).rejects.toThrow(/on shift/);

    await expect(cmd(acc, "SubmitWorkTask", { index: 1, choice: 0 }, minutes(t0, 9))).rejects.toThrow(/hasn't come up/);
    const s = await state(acc, minutes(t0, 9));
    expect(s.shift.tasks).toHaveLength(1);
    const r = await cmd(acc, "SubmitWorkTask", { index: 0, choice: 0 }, minutes(t0, 9));
    await expect(cmd(acc, "SubmitWorkTask", { index: 0, choice: 1 }, minutes(t0, 9))).rejects.toThrow(/already handled/);
    await cmd(acc, "SetWorkStyle", { style: "hard" }, minutes(t0, 30));

    const done = await state(acc, minutes(t0, 61));
    expect(done.shift).toBeNull();
    const h = done.career.history[0];
    expect(h.status).toBe("completed");
    const outcome = (r.receipt as any).outcome as "success" | "ok" | "fail";
    const taskPerf = { success: 3, ok: 0, fail: -2 }[outcome];
    expect(h.perfDelta).toBe(Math.round(10 * 0.5 + 15 * 0.5) + taskPerf);
    const bonus = outcome === "success" ? 13200 * 0.04 : 0;
    expect(h.gross).toBe(Math.round(13200 + bonus));
    expect(h.tax).toBe(0);
    expect(done.wallet.cashPence).toBe(cash0 + h.net);
    expect(done.skills.find((k: any) => k.id === "coding").xp).toBeGreaterThan(0);
    expect(await ledgerMatches(acc)).toBe(true);
    await expect(cmd(acc, "StartShift", {}, minutes(t0, 70))).rejects.toThrow(/already worked a shift today/);
  });

  it("pays nothing before six minutes and prorates an early exit", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, MON);
    await cmd(acc, "JoinCareer", { careerId: "tech" }, MON);
    const t0 = await atOffice(acc, MON);
    await cmd(acc, "StartShift", {}, t0);
    await cmd(acc, "LeaveShift", {}, minutes(t0, 3));
    expect((await state(acc, minutes(t0, 4))).career.history[0].gross).toBe(0);

    const tue = minutes(t0, 24 * 60);
    await cmd(acc, "StartShift", {}, tue);
    await cmd(acc, "LeaveShift", {}, minutes(tue, 30));
    const s = await state(acc, minutes(tue, 31));
    expect(s.career.history[0]).toMatchObject({ status: "left", gross: 6600 });
    expect(s.career.current.shiftsAtGrade).toBe(0);
  });

  it("promotes exactly one grade after the second full shift at 100 performance", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, MON);
    await cmd(acc, "JoinCareer", { careerId: "tech" }, MON);
    await pool().query("UPDATE career_progress SET performance = 95, shifts_at_grade = 1");
    const t0 = await atOffice(acc, MON);
    await cmd(acc, "StartShift", {}, t0);
    await cmd(acc, "SetWorkStyle", { style: "hard" }, t0);
    const s = await state(acc, minutes(t0, 61));
    expect(s.career.current).toMatchObject({ title: "Intern II", performance: 60, shiftsAtGrade: 0 });
    expect(s.career.history[0].promoted).toBe(true);
    await state(acc, minutes(t0, 62));
    expect((await state(acc, minutes(t0, 63))).career.current.title).toBe("Intern II");
  });

  it("taxes wages above the weekly allowance", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, MON);
    await cmd(acc, "JoinCareer", { careerId: "tech" }, MON);
    const t0 = await atOffice(acc, MON);
    await pool().query(
      `INSERT INTO shifts (id, character_id, career_id, rank, grade, salary_pence, location, status, started_at, ends_at, settled_at, period_key, week_key, styles, tasks, gross_pence)
       SELECT gen_random_uuid(), id, 'tech', 1, 1, 40000, 'city_office', 'completed', $2, $2, $2, '2026-10-05', $1, '[]', '[]', 40000 FROM characters`,
      // A fixed earlier time (not the real clock), so this shift always sorts before the one under test.
      ["2026-W42", new Date(MON.getTime() - 3_600_000)],
    );
    await cmd(acc, "StartShift", {}, t0);
    const s = await state(acc, minutes(t0, 61));
    expect(s.career.history[0].tax).toBe(Math.round(s.career.history[0].gross * 0.2));
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
