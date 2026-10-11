import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { checkinReward, perkDef } from "@/content/goals";
import { furnitureDef } from "@/content/catalogue";
import { cmd, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

const T0 = new Date("2026-10-10T09:00:00Z");
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

const setStars = (acc: string, n: number) => pool().query("UPDATE characters SET stars = $2 WHERE account_id = $1", [acc, n]);

describe("K · goals", () => {
  it("check-in: once a day, streak grows on consecutive days and resets after a gap", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "DailyCheckIn", {}, T0);
    await expect(cmd(acc, "DailyCheckIn", {}, minutes(T0, 60))).rejects.toThrow(/already checked in/);
    await cmd(acc, "DailyCheckIn", {}, day(1));
    await cmd(acc, "DailyCheckIn", {}, day(2));
    let s = await state(acc, day(2));
    expect(s.goals.checkin.streak).toBe(3);
    expect(s.wallet.cashPence - before).toBe(checkinReward(1).pence + checkinReward(2).pence + checkinReward(3).pence);
    await cmd(acc, "DailyCheckIn", {}, day(4));
    s = await state(acc, day(4));
    expect(s.goals.checkin.streak).toBe(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("wishes: three a day, claimable only after the qualifying event, stars once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const s = await state(acc, T0);
    expect(s.goals.wishes).toHaveLength(3);
    const w = s.goals.wishes[0];
    await expect(cmd(acc, "ClaimWish", { wishId: w.id }, T0)).rejects.toThrow(/Not done/);
    // Fake the qualifying events directly in the event stream.
    const { WISHES } = await import("@/content/goals");
    const def = WISHES.find((x) => x.id === w.id)!;
    const charId = (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id;
    for (let i = 0; i < def.target; i++)
      await pool().query("INSERT INTO game_events (character_id, type, data, period_key, created_at) VALUES ($1,$2,$3,$4,$5)", [charId, def.event, def.match ?? {}, s.day, T0]);
    const stars = s.character.stars;
    await cmd(acc, "ClaimWish", { wishId: w.id }, T0);
    await expect(cmd(acc, "ClaimWish", { wishId: w.id }, T0)).rejects.toThrow(/Already claimed/);
    expect((await state(acc, T0)).character.stars).toBe(stars + def.stars);
  });

  it("perks: need enough stars, can't be bought twice, and change decay rates going forward", async () => {
    const a = await makeAccount();
    const b = await makeAccount();
    await makeCharacter(a, T0);
    await makeCharacter(b, T0);
    await expect(cmd(a, "BuyPerk", { perkId: "light_eater" }, T0)).rejects.toThrow(/costs 8 stars/);
    await setStars(a, 20);
    await cmd(a, "BuyPerk", { perkId: "light_eater" }, T0);
    await expect(cmd(a, "BuyPerk", { perkId: "light_eater" }, T0)).rejects.toThrow(/already have/);
    expect((await state(a, T0)).character.stars).toBe(20 - perkDef("light_eater")!.stars);
    // After the newcomer grace day, compare two hours of decay with and without the perk.
    const later = day(2);
    const t1 = new Date(later.getTime() + 2 * 3_600_000);
    const sa0 = await state(a, later);
    const sb0 = await state(b, later);
    const sa1 = await state(a, t1);
    const sb1 = await state(b, t1);
    const dropA = sa0.needs.hunger - sa1.needs.hunger;
    const dropB = sb0.needs.hunger - sb1.needs.hunger;
    expect(dropA).toBeCloseTo(dropB * 0.75, 1);
  });

  it("Bargain Hunter takes 10% off furniture and the resale value follows the price paid", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.99);
    await setStars(acc, 10);
    await cmd(acc, "BuyPerk", { perkId: "bargain_hunter" }, T0);
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "BuyFurniture", { defId: "plant" }, T0);
    const s = await state(acc, T0);
    expect(before - s.wallet.cashPence).toBe(Math.round(furnitureDef("plant")!.pricePence * 0.9));
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("moodlets: sleeping grants Well rested, it shows in mood and expires", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartActivity", { activityId: "sleep" }, T0);
    const s = await state(acc, minutes(T0, 21));
    expect(s.moodlets.map((m: any) => m.id)).toContain("well_rested");
    expect(s.mood.factors.some((f: any) => f.label === "Well rested")).toBe(true);
    const gone = await state(acc, minutes(T0, 21 + 300));
    expect(gone.moodlets.map((m: any) => m.id)).not.toContain("well_rested");
  });

  it("friendships grow with time spent with a local", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartJourney", { destination: "common_room", mode: "taxi" }, T0);
    let t = minutes(T0, 5);
    for (let i = 0; i < 3; i++) {
      await cmd(acc, "StartActivity", { activityId: "chat_bev" }, t);
      t = minutes(t, 34);
    }
    const s = await state(acc, t);
    const bev = s.goals.friends.find((f: any) => f.id === "bev");
    expect(bev.points).toBe(3);
    expect(bev.title).toBe("Acquaintance");
  });

  it("ambition milestones pay once and the ambition can only change weekly", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "ChangeAmbition", { ambitionId: "music_master" }, T0);
    await expect(cmd(acc, "ChangeAmbition", { ambitionId: "founder" }, day(1))).rejects.toThrow(/change your ambition again/);
    await expect(cmd(acc, "ClaimAmbition", { milestone: 0.25 }, T0)).rejects.toThrow(/haven't reached/);
    await pool().query("UPDATE skills SET xp = 700 WHERE skill_id = 'music' AND character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc]);
    const s0 = await state(acc, T0);
    expect(s0.goals.ambition.progress).toBeCloseTo(0.4);
    await cmd(acc, "ClaimAmbition", { milestone: 0.25 }, T0);
    await expect(cmd(acc, "ClaimAmbition", { milestone: 0.25 }, T0)).rejects.toThrow(/Already claimed/);
    await expect(cmd(acc, "ClaimAmbition", { milestone: 0.5 }, T0)).rejects.toThrow(/haven't reached/);
    expect((await state(acc, T0)).character.stars).toBe(s0.character.stars + 2);
    await cmd(acc, "ChangeAmbition", { ambitionId: "founder" }, day(8));
  });
});
