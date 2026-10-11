import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { treasureFor } from "@/server/stories";
import { treasureReward } from "@/content/stories";
import { londonDayKey } from "@/sim/time";
import { cmd, ledgerMatches, makeAccount, makeCharacter, resetDb, state } from "./helpers";

// 14:00 London time, Saturday.
const T0 = new Date("2026-10-10T13:00:00Z");
const after = (d: Date, ms: number) => new Date(d.getTime() + ms);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function taxi(acc: string, destination: string, at: Date) {
  await cmd(acc, "StartJourney", { destination, mode: "taxi" }, at);
  const s = await state(acc, at);
  return after(new Date(s.journey.arrivesAt), 1000);
}

describe("I · stories", () => {
  it("requires arrival, records choices, and pays an ending once across replays", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartStory", { storyId: "night_bus" }, T0);
    let s = await state(acc, T0);
    expect(s.stories.active.nodeId).toBe("bus");
    await cmd(acc, "ChooseStory", { choiceId: "keep", nodeId: "bus" }, T0);
    s = await state(acc, T0);
    expect(s.stories.active.nodeId).toBe("library");
    expect(s.stories.active.here).toBe(false);
    await expect(cmd(acc, "ChooseStory", { choiceId: "clues" }, T0)).rejects.toThrow(/happens at Public Reading Library/);
    // A stale choice for the previous scene is refused.
    await expect(cmd(acc, "ChooseStory", { choiceId: "keep", nodeId: "bus" }, T0)).rejects.toThrow(/moved on/);
    let t = await taxi(acc, "reading_library", T0);
    await cmd(acc, "ChooseStory", { choiceId: "clues" }, t);
    t = await taxi(acc, "food_hall", t);
    await cmd(acc, "ChooseStory", { choiceId: "river" }, t);
    t = await taxi(acc, "south_bank", t);
    const before = await state(acc, t);
    await cmd(acc, "ChooseStory", { choiceId: "return" }, t);
    s = await state(acc, t);
    expect(s.stories.active).toBeNull();
    expect(s.character.reputation.xp - before.character.reputation.xp).toBe(80);
    expect(s.character.stars - before.character.stars).toBe(1);
    expect(s.stories.catalogue.find((x: any) => x.id === "night_bus").completed).toBe(true);
    // Replay: same ending, no second reward.
    await cmd(acc, "StartStory", { storyId: "night_bus" }, t);
    const leave = await taxi(acc, "home", t);
    await cmd(acc, "ChooseStory", { choiceId: "driver" }, leave);
    const s2 = await state(acc, leave);
    expect(s2.character.reputation.xp).toBe(s.character.reputation.xp);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("charges a story cost once, blocks it when unaffordable, and only one story runs at a time", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartStory", { storyId: "guest_list" }, T0);
    await expect(cmd(acc, "StartStory", { storyId: "derby_day" }, T0)).rejects.toThrow(/current story/);
    const t = await taxi(acc, "crown_and_curl", T0);
    const before = (await state(acc, t)).wallet.cashPence;
    await cmd(acc, "ChooseStory", { choiceId: "buy" }, t);
    const s = await state(acc, t);
    expect(before - s.wallet.cashPence).toBe(2500);
    expect(s.stories.active.nodeId).toBe("market");
    await cmd(acc, "LeaveStory", {}, t);
    expect((await state(acc, t)).stories.active).toBeNull();
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("a chance roll is stored and can't be rerolled by reloading", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartStory", { storyId: "derby_day" }, T0);
    const t = await taxi(acc, "last_stop_pub", T0);
    await cmd(acc, "ChooseStory", { choiceId: "away" }, t);
    await cmd(acc, "ChooseStory", { choiceId: "quiet" }, t);
    await cmd(acc, "ChooseStory", { choiceId: "captain" }, t);
    const runs = (await pool().query("SELECT log, ending FROM story_runs")).rows;
    const last = runs[0].log[runs[0].log.length - 1];
    expect(typeof last.roll).toBe("number");
    expect(runs[0].ending).toBe(last.success ? "end_legend" : "end_good");
  });
});

describe("J · daily treasure", () => {
  it("eleven racing finders get unique ranks and the published rewards", async () => {
    const day = londonDayKey(T0);
    const spot = treasureFor(day);
    const accs: string[] = [];
    for (let i = 0; i < 11; i++) {
      const a = await makeAccount();
      await makeCharacter(a, T0);
      await pool().query("UPDATE characters SET location = $2 WHERE account_id = $1", [a, spot.venue]);
      accs.push(a);
    }
    // Open hours vary by venue; pick a time when every venue is open (14:00 London).
    const results = await Promise.allSettled(accs.map((a) => cmd(a, "ClaimTreasure", {}, T0)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const claims = (await pool().query("SELECT rank, reward_pence FROM treasure_claims WHERE day = $1 ORDER BY rank", [day])).rows;
    expect(claims.map((c) => Number(c.rank))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(claims.map((c) => Number(c.reward_pence))).toEqual(claims.map((c) => treasureReward(Number(c.rank))));
    await expect(cmd(accs[0], "ClaimTreasure", {}, T0)).rejects.toThrow(/already found/);
    for (const a of accs) expect(await ledgerMatches(a)).toBe(true);
  });

  it("requires being at the right place", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const spot = treasureFor(londonDayKey(T0));
    if (spot.venue !== "home") await expect(cmd(acc, "ClaimTreasure", {}, T0)).rejects.toThrow(/no treasure here/);
    const s = await state(acc, T0);
    expect(s.treasure.anchor).toBeNull();
    expect(s.treasure.clue).toBe(spot.clue);
  });
});
