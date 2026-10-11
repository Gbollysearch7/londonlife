import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { RHYTHM, beatMap, pickQuestions, songLengthMs } from "@/content/minigames";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, resetDb, state } from "./helpers";

// 19:00 London on a Saturday: the pub and the music room are open.
const T0 = new Date("2026-10-10T18:00:00Z");
const after = (d: Date, ms: number) => new Date(d.getTime() + ms);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function goTo(acc: string, destination: string, at: Date) {
  await cmd(acc, "StartJourney", { destination, mode: "taxi" }, at);
  const s = await state(acc, at);
  return after(new Date(s.journey.arrivesAt), 1000);
}

describe("H · minigames", () => {
  it("pub quiz: answers are checked on the server, the prize pays once and a replay is refused", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const at = await goTo(acc, "last_stop_pub", T0);
    const before = (await state(acc, at)).wallet.cashPence;
    await cmd(acc, "StartActivity", { activityId: "pub_quiz" }, at);
    let s = await state(acc, after(at, 1000));
    expect(s.minigame.kind).toBe("quiz");
    expect(s.minigame.questions).toHaveLength(5);
    expect(JSON.stringify(s.minigame)).not.toMatch(/"answer"/);
    const run = s.minigame.id;
    const { pool: p } = await import("@/server/db");
    const seed = (await p().query("SELECT seed FROM minigame_runs WHERE id = $1", [run])).rows[0].seed;
    const answers = pickQuestions(seed).map((q) => q.answer);
    const k = key();
    const r = await cmd(acc, "SubmitMinigame", { runId: run, answers }, after(at, 30_000), k);
    expect((r.receipt as any).result.correct).toBe(5);
    // Same key replays; a new key is refused.
    const again = await cmd(acc, "SubmitMinigame", { runId: run, answers }, after(at, 31_000), k);
    expect(again.replayed).toBe(true);
    await expect(cmd(acc, "SubmitMinigame", { runId: run, answers }, after(at, 32_000))).rejects.toThrow(/already/);
    s = await state(acc, after(at, 33_000));
    expect(s.activity).toBeNull();
    expect(s.minigame).toBeNull();
    expect(s.wallet.cashPence - before).toBe(2500);
    expect(s.character.stars).toBeGreaterThanOrEqual(1);
    expect(await ledgerMatches(acc)).toBe(true);
    // Daily limit of one quiz.
    await expect(cmd(acc, "StartActivity", { activityId: "pub_quiz" }, after(at, 40_000))).rejects.toThrow(/Limit/);
  });

  it("open mic: a perfect set earns capped tips; submitting before the song ends is refused", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const at = await goTo(acc, "camden_backroom", T0);
    await cmd(acc, "StartActivity", { activityId: "open_mic" }, at);
    const s = await state(acc, after(at, 500));
    const seed = (await pool().query("SELECT seed FROM minigame_runs WHERE id = $1", [s.minigame.id])).rows[0].seed;
    const notes = beatMap(seed, RHYTHM.open_mic);
    await expect(cmd(acc, "SubmitMinigame", { runId: s.minigame.id, taps: notes }, after(at, 1000))).rejects.toThrow(/isn't over/);
    const r = await cmd(acc, "SubmitMinigame", { runId: s.minigame.id, taps: notes }, after(at, songLengthMs(notes) + 1000));
    const res = (r.receipt as any).result;
    expect(res.accuracy).toBe(1);
    expect(res.pence).toBeGreaterThan(0);
    expect(res.pence).toBeLessThanOrEqual(RHYTHM.open_mic.maxPayPence);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("letting the timer run out earns nothing and closes the run", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const at = await goTo(acc, "last_stop_pub", T0);
    const before = await state(acc, at);
    await cmd(acc, "StartActivity", { activityId: "pub_quiz" }, at);
    const run = (await state(acc, after(at, 500))).minigame.id;
    const late = after(at, 10 * 60_000);
    const s = await state(acc, late);
    expect(s.activity).toBeNull();
    expect(s.minigame).toBeNull();
    expect(s.wallet.cashPence).toBe(before.wallet.cashPence);
    expect(s.skills.find((k: any) => k.id === "charisma").xp).toBe(before.skills.find((k: any) => k.id === "charisma").xp);
    await expect(cmd(acc, "SubmitMinigame", { runId: run, answers: [0, 0, 0, 0, 0] }, late)).rejects.toThrow(/Too late|ended/);
  });

  it("cancelling a minigame closes it without reward", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const at = await goTo(acc, "last_stop_pub", T0);
    await cmd(acc, "StartActivity", { activityId: "pub_quiz" }, at);
    const run = (await state(acc, after(at, 500))).minigame.id;
    await cmd(acc, "CancelActivity", {}, after(at, 2000));
    await expect(cmd(acc, "SubmitMinigame", { runId: run, answers: [0] }, after(at, 3000))).rejects.toThrow(/Too late|ended/);
  });
});
