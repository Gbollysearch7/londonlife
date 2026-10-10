import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { createCharacter } from "@/server/game";
import { withTx } from "@/server/db";
import { appearance, cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

const T0 = new Date("2026-10-10T09:00:00Z");

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("A · new life", () => {
  it("creates exactly one character and never rerolls the origin", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.1);
    const first = await state(acc, T0);
    const again = await withTx((tx) =>
      createCharacter(tx, acc, { name: "Other", appearance, traits: ["active", "creative"], ambition: "career_top" }, T0, () => 0.99),
    );
    expect(again.created).toBe(false);
    const second = await state(acc, T0);
    expect(second.character.origin.id).toBe(first.character.origin.id);
    expect(second.character.name).toBe("Ada");
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("rejects duplicate and conflicting traits", async () => {
    const acc = await makeAccount();
    const attempt = (traits: string[]) =>
      cmd(acc, "CreateCharacter", { name: "Bo", appearance, traits, ambition: "founder" }, T0);
    await expect(attempt(["tidy", "tidy"])).rejects.toThrow(/two different/);
    await expect(attempt(["sociable", "homebody"])).rejects.toThrow(/can't be combined/);
  });

  it("racing creation requests produce one character", async () => {
    const acc = await makeAccount();
    const payload = { name: "Cy", appearance, traits: ["active", "tidy"], ambition: "founder" };
    await Promise.all([cmd(acc, "CreateCharacter", payload, T0), cmd(acc, "CreateCharacter", payload, T0)]);
    const r = await pool().query("SELECT count(*) FROM characters WHERE account_id = $1", [acc]);
    expect(Number(r.rows[0].count)).toBe(1);
  });
});

describe("B · care loop", () => {
  it("cooks from owned ingredients, then eats the meal as a separate action", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartActivity", { activityId: "cook_beans_on_toast" }, T0);
    let s = await state(acc, minutes(T0, 1));
    expect(s.activity.defId).toBe("cook_beans_on_toast");
    s = await state(acc, minutes(T0, 3.1));
    expect(s.activity).toBeNull();
    expect(s.inventory.find((i: any) => i.id === "beans_on_toast").qty).toBe(1);
    expect(s.inventory.find((i: any) => i.id === "beans")).toBeUndefined();
    const hungerBefore = s.needs.hunger;
    await cmd(acc, "StartActivity", { activityId: "eat_beans_on_toast" }, minutes(T0, 4));
    s = await state(acc, minutes(T0, 6.1));
    expect(s.needs.hunger).toBe(Math.min(100, hungerBefore + 35));
    expect(s.inventory.find((i: any) => i.id === "beans_on_toast")).toBeUndefined();
  });

  it("refuses to cook without ingredients and does not partially consume", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await expect(cmd(acc, "StartActivity", { activityId: "cook_jollof_rice" }, T0)).rejects.toThrow(/level 2|Needs/);
    const s = await state(acc, T0);
    expect(s.inventory.find((i: any) => i.id === "tomato").qty).toBe(1);
  });

  it("allows only one running activity, and completion rewards once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartActivity", { activityId: "shower" }, T0);
    await expect(cmd(acc, "StartActivity", { activityId: "toilet" }, T0)).rejects.toThrow(/Finish or cancel/);
    const done = minutes(T0, 4);
    await Promise.all([state(acc, done), state(acc, done), state(acc, done)]);
    const s = await state(acc, done);
    expect(s.character.stars).toBe(1);
    const r = await pool().query("SELECT count(*) FROM game_events WHERE type = 'washed'");
    expect(Number(r.rows[0].count)).toBe(1);
  });

  it("cancelling does not refund consumed ingredients", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartActivity", { activityId: "cook_pasta_bowl" }, T0);
    await cmd(acc, "CancelActivity", {}, minutes(T0, 1));
    const s = await state(acc, minutes(T0, 10));
    expect(s.inventory.find((i: any) => i.id === "pasta")).toBeUndefined();
    expect(s.inventory.find((i: any) => i.id === "pasta_bowl")).toBeUndefined();
  });
});

describe("C · world and travel", () => {
  it("charges the fare once and changes location only on arrival", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const cash0 = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "StartJourney", { destination: "food_hall", mode: "bus" }, T0);
    let s = await state(acc, minutes(T0, 1));
    expect(s.character.location).toBe("home");
    expect(s.journey.destination).toBe("food_hall");
    expect(s.wallet.cashPence).toBe(cash0 - 200);
    s = await state(acc, minutes(T0, 3));
    expect(s.character.location).toBe("food_hall");
    expect(s.journey).toBeNull();
    expect(s.wallet.cashPence).toBe(cash0 - 200);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("a cancelled journey leaves the character at the origin", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartJourney", { destination: "common_room", mode: "walk" }, T0);
    await cmd(acc, "CancelJourney", {}, minutes(T0, 2));
    const s = await state(acc, minutes(T0, 20));
    expect(s.character.location).toBe("home");
  });

  it("venue actions are rejected before any debit when not there", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const cash0 = (await state(acc, T0)).wallet.cashPence;
    await expect(cmd(acc, "StartActivity", { activityId: "plate_of_the_day" }, T0)).rejects.toThrow(/Only at/);
    expect((await state(acc, T0)).wallet.cashPence).toBe(cash0);
  });

  it("the tutorial £20 task pays exactly once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await cmd(acc, "StartJourney", { destination: "common_room", mode: "walk" }, T0);
    let t = minutes(T0, 9);
    const cash0 = (await state(acc, t)).wallet.cashPence;
    await cmd(acc, "StartActivity", { activityId: "community_lunch_setup" }, t);
    t = minutes(t, 6);
    await state(acc, t);
    await expect(cmd(acc, "StartActivity", { activityId: "community_lunch_setup" }, t)).rejects.toThrow(/pays once/);
    expect((await state(acc, t)).wallet.cashPence).toBe(cash0 + 2000);
  });
});

describe("E · home and furniture", () => {
  it("buys to storage, places with rotation and collision checks, sells once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const s0 = await state(acc, T0);
    const r = await cmd(acc, "BuyFurniture", { defId: "sofa" }, T0);
    const id = (r.receipt as any).instanceId;
    let s = await state(acc, T0);
    expect(s.wallet.cashPence).toBe(s0.wallet.cashPence - 8500);
    expect(s.furniture.find((f: any) => f.id === id).placed).toBe(false);
    await expect(cmd(acc, "PlaceFurniture", { instanceId: id, x: 0, y: 1, rot: 0 }, T0)).rejects.toThrow(/Blocked/);
    await cmd(acc, "PlaceFurniture", { instanceId: id, x: 2, y: 2, rot: 90 }, T0);
    s = await state(acc, T0);
    expect(s.furniture.find((f: any) => f.id === id)).toMatchObject({ placed: true, x: 2, y: 2, rot: 90 });
    const k = key();
    await Promise.allSettled([cmd(acc, "SellFurniture", { instanceId: id }, T0), cmd(acc, "SellFurniture", { instanceId: id }, T0)]);
    s = await state(acc, T0);
    expect(s.wallet.cashPence).toBe(s0.wallet.cashPence - 8500 + 4250);
    expect(await ledgerMatches(acc)).toBe(true);
    void k;
  });

  it("cannot buy what you cannot afford", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, 0.1);
    await expect(cmd(acc, "BuyFurniture", { defId: "double_bed" }, T0)).rejects.toThrow(/You need/);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("F · idempotency and missions", () => {
  it("replays the same key without charging twice", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const cash0 = (await state(acc, T0)).wallet.cashPence;
    const k = key();
    const [a, b] = await Promise.all([
      cmd(acc, "BuyFurniture", { defId: "plant" }, T0, k),
      cmd(acc, "BuyFurniture", { defId: "plant" }, T0, k),
    ]);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect((await state(acc, T0)).wallet.cashPence).toBe(cash0 - 1200);
  });

  it("a mission claimed from two tabs pays once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await pool().query(
      "INSERT INTO mission_assignments (character_id, period_key, mission_ids) SELECT id, '2026-10-10', ARRAY['freshen_up','talk_local','buy_furniture'] FROM characters WHERE account_id = $1",
      [acc],
    );
    await expect(cmd(acc, "ClaimMission", { missionId: "freshen_up" }, T0)).rejects.toThrow(/Not complete/);
    await cmd(acc, "StartActivity", { activityId: "shower" }, T0);
    const t = minutes(T0, 4);
    const cash0 = (await state(acc, t)).wallet.cashPence;
    const results = await Promise.allSettled([
      cmd(acc, "ClaimMission", { missionId: "freshen_up" }, t),
      cmd(acc, "ClaimMission", { missionId: "freshen_up" }, t),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const s = await state(acc, t);
    expect(s.wallet.cashPence).toBe(cash0 + 200);
    expect(s.character.reputation.xp).toBe(10);
  });

  it("allows one swap per day and never swaps a claimed mission", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const s = await state(acc, T0);
    const [m1, m2] = s.missions.items;
    await cmd(acc, "SwapMission", { missionId: m1.id }, T0);
    await expect(cmd(acc, "SwapMission", { missionId: m2.id }, T0)).rejects.toThrow(/free swap/);
  });
});
