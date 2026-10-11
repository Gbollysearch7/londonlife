import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { STAFF, PARTY, utilitiesFor } from "@/content/household";
import { activeOutage } from "@/sim/outage";
import { proratedWage } from "@/server/household";
import { londonDayKey } from "@/sim/time";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London — just after the weekly bill time, so the first bills fall on 17 Oct.
const T0 = new Date("2026-10-10T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const hours = (base: Date, h: number) => new Date(base.getTime() + h * 3_600_000);
const NEXT_SAT = new Date("2026-10-17T08:00:00Z"); // 09:00 BST

const GRADUATE = 0.3; // shared room 6×6
const FAMILY = 0.9; // studio 7×7
const INHERITED = 0.999; // owned one-bed 8×8

const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );
const charId = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;
const utilityBills = (s: any) => s.bank.bills.filter((b: any) => b.kind === "utilities");
const staffBills = (s: any) => s.bank.bills.filter((b: any) => b.kind === "staff");

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("Q · utilities", () => {
  it("are covered during starting support, then billed every Saturday exactly once", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, GRADUATE);
    let s = await state(acc, days(8));
    expect(utilityBills(s).map((b: any) => b.status)).toEqual(["covered"]);
    s = await state(acc, days(15));
    const cash = s.wallet.cashPence;
    s = await state(acc, days(22));
    expect(utilityBills(s)[0].status).toBe("paid");
    expect(utilityBills(s)[0].amountPence).toBe(utilitiesFor("shared_room"));
    expect(cash - s.wallet.cashPence).toBe(8000 + utilitiesFor("shared_room"));
    await state(acc, days(22.5));
    s = await state(acc, days(23));
    expect(utilityBills(s).filter((b: any) => b.status === "paid")).toHaveLength(1);
    expect(s.household.utilitiesPence).toBe(utilitiesFor("shared_room"));
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("owned homes pay no rent but still pay utilities", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    const s = await state(acc, days(30));
    expect(s.bank.bills.filter((b: any) => b.kind === "rent")).toHaveLength(0);
    expect(utilityBills(s).filter((b: any) => b.status === "paid").length).toBeGreaterThan(0);
    expect(utilityBills(s).every((b: any) => b.amountPence === utilitiesFor("one_bed"))).toBe(true);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("an unaffordable bill stays unpaid (no overdraft) and can be paid later", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await state(acc, days(15));
    await setCash(acc, 100);
    let s = await state(acc, days(22));
    expect(s.wallet.cashPence).toBe(100);
    expect(s.bank.unpaidPence).toBe(utilitiesFor("one_bed"));
    await expect(cmd(acc, "HireStaff", { role: "cleaner" }, days(22))).rejects.toThrow(/unpaid bills/);
    await setCash(acc, 10000);
    await cmd(acc, "PayBills", {}, days(22));
    s = await state(acc, days(22));
    expect(s.bank.unpaidPence).toBe(0);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("R · outages", () => {
  it("a hot-water outage blocks only the home shower, says why, and points to free showers", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, GRADUATE);
    const id = await charId(acc);
    // Find this character's first hot-water outage (deterministic per week).
    let t: Date | null = null;
    // Outages start after the newcomer's quiet first fortnight.
    for (let h = 24 * 15; h < 24 * 7 * 40 && !t; h++) {
      const at = hours(T0, h);
      if (activeOutage(id, at)?.kind === "hot_water") t = at;
    }
    expect(t).not.toBeNull();
    const at = t!;
    const s = await state(acc, at);
    const shower = s.actions.find((a: any) => a.id === "shower");
    expect(shower.available).toBe(false);
    expect(shower.reason).toMatch(/Hot-water outage/);
    expect(shower.reason).toMatch(/Common Room/);
    expect(s.household.outage.state).toBe("active");
    await expect(cmd(acc, "StartActivity", { activityId: "shower" }, at)).rejects.toThrow(/Hot-water outage/);
    // The toilet (no hot water needed) still works.
    expect(s.actions.find((a: any) => a.id === "toilet").reason ?? "").not.toMatch(/outage/);
    // The same week and hour always gives the same answer, and it clears when the outage ends.
    const later = hours(at, 4);
    if (!activeOutage(id, later)) {
      const s2 = await state(acc, later);
      expect(s2.actions.find((a: any) => a.id === "shower").reason ?? "").not.toMatch(/outage/);
    }
  });
});

describe("S · household staff", () => {
  it("checks home size, charges prorated first wages once, and never refunds", async () => {
    const small = await makeAccount();
    await makeCharacter(small, T0, GRADUATE);
    await expect(cmd(small, "HireStaff", { role: "cleaner" }, T0)).rejects.toThrow(/no room for a cleaner/);

    const acc = await makeAccount();
    await makeCharacter(acc, T0, FAMILY);
    await expect(cmd(acc, "HireStaff", { role: "chef" }, T0)).rejects.toThrow(/no room for a chef/);
    await expect(cmd(acc, "HireStaff", { role: "butler" }, T0)).rejects.toThrow(/Unknown staff role/);
    const before = (await state(acc, T0)).wallet.cashPence;
    const k = key();
    await cmd(acc, "HireStaff", { role: "cleaner" }, T0, k);
    // Replaying the same request never charges twice.
    const replay = await cmd(acc, "HireStaff", { role: "cleaner" }, T0, k);
    expect(replay.replayed).toBe(true);
    await expect(cmd(acc, "HireStaff", { role: "cleaner" }, T0)).rejects.toThrow(/already have a cleaner/);
    let s = await state(acc, T0);
    const cleaner = STAFF.find((x) => x.id === "cleaner")!;
    const first = proratedWage(cleaner.wagePence, T0, NEXT_SAT);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(cleaner.wagePence);
    expect(before - s.wallet.cashPence).toBe(first);
    expect(s.household.staff.find((x: any) => x.id === "cleaner").hired).toBe(true);
    expect(s.mood.factors.some((f: any) => /cleaner/.test(f.label))).toBe(true);

    const mid = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "FireStaff", { role: "cleaner" }, minutes(T0, 5));
    s = await state(acc, minutes(T0, 5));
    expect(s.wallet.cashPence).toBe(mid);
    expect(s.mood.factors.some((f: any) => /cleaner/.test(f.label))).toBe(false);
    await expect(cmd(acc, "FireStaff", { role: "cleaner" }, minutes(T0, 5))).rejects.toThrow(/don't have a cleaner/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("bills weekly wages with the Saturday bills once, and staff leave if wages can't be paid", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await cmd(acc, "HireStaff", { role: "cleaner" }, T0);
    await cmd(acc, "HireStaff", { role: "chef" }, T0);
    let s = await state(acc, days(7.5));
    const wages = STAFF.reduce((t, x) => t + x.wagePence, 0);
    expect(staffBills(s)).toHaveLength(1);
    expect(staffBills(s)[0].amountPence).toBe(wages);
    expect(staffBills(s)[0].status).toBe("paid");
    await state(acc, days(7.6));
    s = await state(acc, days(8));
    expect(staffBills(s)).toHaveLength(1);
    expect(s.household.wagesPence).toBe(wages);
    // Broke on the next Saturday: no debt for unworked weeks, the staff simply leave.
    await setCash(acc, 0);
    s = await state(acc, days(14.5));
    expect(staffBills(s)).toHaveLength(1);
    expect(s.household.staff.every((x: any) => !x.hired)).toBe(true);
    expect(s.notices.some((n: string) => /couldn't be paid/.test(n))).toBe(true);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("moving somewhere too small ends the job without a refund", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await cmd(acc, "HireStaff", { role: "chef" }, T0);
    await cmd(acc, "MoveHome", { tierId: "outer_studio" }, minutes(T0, 1));
    const s = await state(acc, minutes(T0, 2));
    expect(s.household.staff.find((x: any) => x.id === "chef").hired).toBe(false);
    expect(s.household.staff.find((x: any) => x.id === "chef").eligible).toBe(false);
    await expect(cmd(acc, "CollectChefMeal", {}, minutes(T0, 3))).rejects.toThrow(/Hire a chef/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("the chef makes at most three meals a day, only at home, and they can be eaten", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await expect(cmd(acc, "CollectChefMeal", {}, T0)).rejects.toThrow(/Hire a chef/);
    await cmd(acc, "HireStaff", { role: "chef" }, T0);
    for (let i = 0; i < 3; i++) await cmd(acc, "CollectChefMeal", {}, minutes(T0, i + 1));
    await expect(cmd(acc, "CollectChefMeal", {}, minutes(T0, 5))).rejects.toThrow(/3 meals today/);
    let s = await state(acc, minutes(T0, 5));
    const meals = s.inventory.filter((i: any) => i.id.startsWith("chef_"));
    expect(meals.reduce((t: number, i: any) => t + i.qty, 0)).toBe(3);
    expect(s.household.chef.mealsToday).toBe(3);
    const eat = s.actions.find((a: any) => a.id === `eat_${meals[0].id}`);
    expect(eat.available).toBe(true);
    await cmd(acc, "StartActivity", { activityId: eat.id }, minutes(T0, 6));
    // Away from home the chef can't hand you anything.
    await cmd(acc, "StartJourney", { destination: "food_hall", mode: "taxi" }, days(1));
    await expect(cmd(acc, "CollectChefMeal", {}, days(1))).rejects.toThrow(/Go home/);
    s = await state(acc, hours(days(1), 1));
    expect(s.character.location).toBe("food_hall");
    await expect(cmd(acc, "CollectChefMeal", {}, hours(days(1), 1))).rejects.toThrow(/Go home/);
    await cmd(acc, "StartJourney", { destination: "home", mode: "taxi" }, hours(days(1), 1));
    // A new London day refills the chef's three.
    await cmd(acc, "CollectChefMeal", {}, hours(days(1), 2));
    s = await state(acc, hours(days(1), 2));
    expect(s.household.chef.mealsToday).toBe(1);
  });
});

describe("T · skill rust", () => {
  async function setSkill(acc: string, skill: string, xp: number, best: number, lastUsed: Date | null) {
    await pool().query(
      "UPDATE skills SET xp = $3, best_level = $4, last_used_at = $5 WHERE skill_id = $2 AND character_id = (SELECT id FROM characters WHERE account_id = $1)",
      [acc, skill, xp, best, lastUsed],
    );
  }

  it("lowers the effective level used by gates, keeps XP, and practising restores it", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await setSkill(acc, "cooking", 250, 2, days(-30)); // level 2, idle 30 days → effective 1
    await setSkill(acc, "coding", 450, 3, days(-30)); // level 3, idle 30 days → effective 2
    await pool().query("UPDATE inventory SET qty = 5 WHERE item_id IN ('rice', 'tomato', 'plantain') AND character_id = (SELECT id FROM characters WHERE account_id = $1)", [acc]);
    let s = await state(acc, T0);
    const cooking = s.skills.find((k: any) => k.id === "cooking");
    expect(cooking.level).toBe(2);
    expect(cooking.best).toBe(2);
    expect(cooking.effective).toBe(1);
    expect(cooking.rust).toBe(1);
    expect(cooking.xp).toBe(250);
    const jollof = s.actions.find((a: any) => a.id === "cook_jollof_rice");
    expect(jollof.reason).toMatch(/Cooking level 2/);
    await expect(cmd(acc, "StartActivity", { activityId: "cook_jollof_rice" }, T0)).rejects.toThrow(/Cooking level 2/);
    // Career entry uses the same effective level.
    await expect(cmd(acc, "JoinCareer", { careerId: "product" }, T0)).rejects.toThrow(/Coding level 3/);
    // Any practice restores the full level immediately.
    await cmd(acc, "StartActivity", { activityId: "cook_tea_and_toast" }, T0);
    s = await state(acc, minutes(T0, 3));
    expect(s.skills.find((k: any) => k.id === "cooking").effective).toBe(2);
    await cmd(acc, "StartActivity", { activityId: "cook_jollof_rice" }, minutes(T0, 3));
  });

  it("never drops more than two levels below the personal best", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    await setSkill(acc, "music", 1400, 6, days(-400));
    const s = await state(acc, T0);
    const music = s.skills.find((k: any) => k.id === "music");
    expect(music.effective).toBe(4);
    expect(music.nextRustAt).toBeNull();
  });
});

describe("U · house parties", () => {
  async function placeAnywhere(acc: string, instanceId: string, at: Date) {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        try {
          await cmd(acc, "PlaceFurniture", { instanceId, x, y, rot: 0 }, at);
          return;
        } catch {
          /* occupied: try the next cell */
        }
      }
    throw new Error("no free cell");
  }

  it("needs speakers, runs in the evening, once a night, and NPC friends come", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    const evening = hours(T0, 10); // 20:00 London
    await expect(cmd(acc, "StartActivity", { activityId: "house_party" }, evening)).rejects.toThrow(/party speakers/);
    const bought = await cmd(acc, "BuyFurniture", { defId: "party_speakers" }, T0);
    await placeAnywhere(acc, (bought.receipt as any).instanceId, T0);
    await expect(cmd(acc, "StartActivity", { activityId: "house_party" }, T0)).rejects.toThrow(/Only between 17:00/);

    // Two locals reach Friend tier; one is only an acquaintance.
    const id = await charId(acc);
    for (const [npc, n] of [["nia", 9], ["bev", 8], ["priya", 3]] as const)
      for (let i = 0; i < n; i++)
        await pool().query("INSERT INTO game_events (character_id, type, data, period_key, created_at) VALUES ($1,'npc_time',$2,$3,$4)", [id, { npc }, londonDayKey(T0), T0]);

    let s = await state(acc, evening);
    expect(s.household.party.hasSpeakers).toBe(true);
    expect(s.household.party.guests.map((g: any) => g.name).sort()).toEqual(["Bev", "Nia"].sort());
    const before = s.wallet.cashPence;
    const social0 = s.needs.social;
    await cmd(acc, "StartActivity", { activityId: "house_party" }, evening);
    s = await state(acc, minutes(evening, 31));
    expect(before - s.wallet.cashPence).toBe(2000);
    expect(s.needs.social).toBeGreaterThan(social0);
    expect(s.moodlets.some((m: any) => m.id === "party_host")).toBe(true);
    expect(s.household.party.last.guests.sort()).toEqual(["Bev", "Nia"].sort());
    const party = (await pool().query("SELECT guests FROM house_parties WHERE character_id = $1", [id])).rows;
    expect(party).toHaveLength(1);
    expect(party[0].guests).toHaveLength(2);
    const done = await pool().query("SELECT result FROM activities WHERE character_id = $1 AND def_id = 'house_party'", [id]);
    expect(JSON.stringify(done.rows[0].result)).toMatch(/NPC guests came: .*not players/);

    // One party a night, whichever way you pay (including after midnight).
    await expect(cmd(acc, "StartActivity", { activityId: "house_party" }, minutes(evening, 40))).rejects.toThrow(/already thrown a party tonight/);
    await expect(cmd(acc, "StartActivity", { activityId: "house_party_pantry" }, hours(evening, 4))).rejects.toThrow(/already thrown a party tonight/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("the cupboard version needs the groceries and a quiet night still counts", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0, INHERITED);
    const bought = await cmd(acc, "BuyFurniture", { defId: "party_speakers" }, T0);
    await placeAnywhere(acc, (bought.receipt as any).instanceId, T0);
    const evening = hours(T0, 10);
    await expect(cmd(acc, "StartActivity", { activityId: "house_party_pantry" }, evening)).rejects.toThrow(/Needs 3 × Snack bar/);
    await pool().query(
      "INSERT INTO inventory (character_id, item_id, qty) SELECT id, 'snack_bar', 3 FROM characters WHERE account_id = $1 ON CONFLICT (character_id, item_id) DO UPDATE SET qty = 3",
      [acc],
    );
    const before = (await state(acc, evening)).wallet.cashPence;
    await cmd(acc, "StartActivity", { activityId: "house_party_pantry" }, evening);
    const s = await state(acc, minutes(evening, 31));
    expect(s.wallet.cashPence).toBe(before);
    expect(s.household.party.last.guests).toEqual([]);
    expect(s.inventory.find((i: any) => i.id === "snack_bar")).toBeUndefined();
    expect(PARTY.maxGuests).toBeGreaterThan(0);
  });
});
