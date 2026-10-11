import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { VENUES_B } from "@/content/city_b";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// 10:00 London time (BST) on a Saturday.
const T0 = new Date("2026-10-10T09:00:00Z");
/** A London (BST) clock time on the same Saturday. */
const at = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 10, hh - 1, mm));

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

async function travelTo(acc: string, destination: string, when: Date, mode = "tube") {
  await cmd(acc, "StartJourney", { destination, mode }, when);
  const s = await state(acc, when);
  return new Date(new Date(s.journey.arrivesAt).getTime() + 1000);
}

/** Creates a character and puts it at a venue, arriving at or after `when`. */
async function playerAt(destination: string, when = T0) {
  const acc = await makeAccount();
  await makeCharacter(acc, when);
  const arrived = await travelTo(acc, destination, when);
  return { acc, arrived };
}

const action = (s: any, id: string) => s.actions.find((a: any) => a.id === id);
const cash = async (acc: string, when: Date) => (await state(acc, when)).wallet.cashPence as number;

describe("M2 venues part B", () => {
  it("lists all nine new venues in the directory with their districts and opening times", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    const s = await state(acc, T0);
    for (const v of VENUES_B) {
      const d = s.directory.find((x: any) => x.id === v.id);
      expect(d, v.id).toBeDefined();
      expect(d.district).toBe(v.district);
      expect(d.quotes.length).toBeGreaterThan(0);
    }
  });

  it("every new venue can be reached and offers things to do", async () => {
    for (const v of VENUES_B) {
      const opensAt = v.hours ? Math.max(v.hours[0], 10) : 10;
      const { acc, arrived } = await playerAt(v.id, at(opensAt));
      const s = await state(acc, arrived);
      expect(s.character.location).toBe(v.id);
      const here = s.actions.filter((a: any) => !a.hidden);
      expect(here.length, v.id).toBeGreaterThanOrEqual(4);
      expect(here.some((a: any) => a.available), `${v.id} has nothing available at ${opensAt}:00`).toBe(true);
    }
  });

  it("rejects a venue activity from the wrong place", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await expect(cmd(acc, "StartActivity", { activityId: "penalty_practice" }, T0)).rejects.toThrow(/Only at Borough Stadium/);
  });

  describe("The Members' Green reputation gate", () => {
    it("shows the gate, rejects before charging and keeps the public range open", async () => {
      const { acc, arrived } = await playerAt("members_green");
      const s = await state(acc, arrived);
      const round = action(s, "golf_round");
      expect(round.available).toBe(false);
      expect(round.reason).toMatch(/Members only: needs reputation level 4 \(Borough Favourite\)/);
      for (const id of ["clubhouse_lunch", "members_network"]) expect(action(s, id).available).toBe(false);
      const before = await cash(acc, arrived);
      await expect(cmd(acc, "StartActivity", { activityId: "golf_round" }, arrived)).rejects.toThrow(/Members only/);
      expect(await cash(acc, arrived)).toBe(before);

      // The affordable public alternative works for anyone.
      expect(action(s, "range_bucket").available).toBe(true);
      await cmd(acc, "StartActivity", { activityId: "range_bucket" }, arrived);
      const done = await state(acc, minutes(arrived, 11));
      expect(done.wallet.cashPence).toBe(before - 500);
      expect(done.skills.find((k: any) => k.id === "fitness").xp).toBeGreaterThan(0);
      expect(await ledgerMatches(acc)).toBe(true);
    });

    it("lets a Borough Favourite play, charging the green fee once even if the request is replayed", async () => {
      const { acc, arrived } = await playerAt("members_green");
      await pool().query("UPDATE characters SET reputation_xp = 700 WHERE account_id = $1", [acc]);
      const before = await cash(acc, arrived);
      const k = key();
      await cmd(acc, "StartActivity", { activityId: "golf_round" }, arrived, k);
      await cmd(acc, "StartActivity", { activityId: "golf_round" }, arrived, k);
      expect(await cash(acc, arrived)).toBe(before - 3000);
      const s = await state(acc, minutes(arrived, 16));
      expect(s.activity).toBeFalsy();
      expect(await ledgerMatches(acc)).toBe(true);
    });

    it("one reputation level short is still turned away", async () => {
      const { acc, arrived } = await playerAt("members_green");
      await pool().query("UPDATE characters SET reputation_xp = 699 WHERE account_id = $1", [acc]);
      await expect(cmd(acc, "StartActivity", { activityId: "clubhouse_lunch" }, arrived)).rejects.toThrow(/Members only/);
    });
  });

  describe("Borough Stadium timed events", () => {
    it("match tickets sell only inside the gate window, once a day", async () => {
      const { acc, arrived } = await playerAt("borough_stadium", at(10));
      let s = await state(acc, arrived);
      expect(action(s, "stadium_match").reason).toMatch(/Only between 14:00 and 17:00/);
      await expect(cmd(acc, "StartActivity", { activityId: "stadium_match" }, arrived)).rejects.toThrow(/Only between/);
      // Morning tour and training pitch are open instead.
      expect(action(s, "stadium_tour").available).toBe(true);
      expect(action(s, "penalty_practice").available).toBe(true);

      const kickoff = at(15);
      const before = await cash(acc, kickoff);
      await cmd(acc, "StartActivity", { activityId: "stadium_match" }, kickoff);
      expect(await cash(acc, kickoff)).toBe(before - 2500);
      s = await state(acc, minutes(kickoff, 16));
      expect(action(s, "stadium_match").reason).toMatch(/Limit of 1 per day/);
      await expect(cmd(acc, "StartActivity", { activityId: "stadium_match" }, minutes(kickoff, 16))).rejects.toThrow(/Limit/);
      // The training pitch closes during events.
      expect(action(s, "penalty_practice").available).toBe(false);
      expect(await ledgerMatches(acc)).toBe(true);
    });

    it("the scarf is a one-a-day souvenir moment, not a wardrobe item", async () => {
      const { acc, arrived } = await playerAt("borough_stadium", at(11));
      const garments = async () => (await pool().query("SELECT count(*)::int AS n FROM owned_garments g JOIN characters c ON c.id = g.character_id WHERE c.account_id = $1", [acc])).rows[0].n;
      const before = await garments();
      await cmd(acc, "StartActivity", { activityId: "stadium_scarf" }, arrived);
      const s = await state(acc, minutes(arrived, 2));
      expect(action(s, "stadium_scarf").available).toBe(false);
      await expect(cmd(acc, "StartActivity", { activityId: "stadium_scarf" }, minutes(arrived, 2))).rejects.toThrow(/Limit/);
      expect(await garments()).toBe(before);
      expect(await ledgerMatches(acc)).toBe(true);
    });
  });

  describe("Riverlight Jetty scheduled sailings", () => {
    it("boards only during each departure's boarding hour", async () => {
      const { acc, arrived } = await playerAt("riverlight_jetty", at(16, 0));
      let s = await state(acc, arrived);
      expect(action(s, "cruise_sunset_17").reason).toMatch(/Only between 17:00 and 18:00/);
      expect(action(s, "cruise_sunset_19").available).toBe(false);
      await expect(cmd(acc, "StartActivity", { activityId: "cruise_sunset_17" }, arrived)).rejects.toThrow(/Only between/);

      const boarding = at(17, 30);
      await cmd(acc, "StartActivity", { activityId: "cruise_sunset_17" }, boarding);
      const back = minutes(boarding, 16);
      s = await state(acc, back);
      expect(s.character.location).toBe("riverlight_jetty");
      // Missed the 17:00 boarding window at 18:10; the 19:00 sailing isn't boarding yet.
      const late = at(18, 10);
      await expect(cmd(acc, "StartActivity", { activityId: "cruise_sunset_17" }, late)).rejects.toThrow(/Only between|Limit/);
      await expect(cmd(acc, "StartActivity", { activityId: "cruise_sunset_19" }, late)).rejects.toThrow(/Only between 19:00 and 20:00/);
      expect(await ledgerMatches(acc)).toBe(true);
    });
  });

  describe("The Thames House Hotel", () => {
    it("a day-room rest restores energy without changing the player's home", async () => {
      const { acc, arrived } = await playerAt("thames_house", at(11));
      const before = await state(acc, arrived);
      await pool().query("UPDATE characters SET energy = 30 WHERE account_id = $1", [acc]);
      await cmd(acc, "StartActivity", { activityId: "hotel_room_rest" }, arrived);
      const after = await state(acc, minutes(arrived, 21));
      expect(after.home.id).toBe(before.home.id);
      expect(after.home.district).toBe(before.home.district);
      expect(after.character.location).toBe("thames_house");
      expect(after.needs.energy).toBeGreaterThan(60);
      expect(after.wallet.cashPence).toBe(before.wallet.cashPence - 4500);
      expect(action(after, "hotel_room_rest").reason).toMatch(/Limit of 1 per day/);
      expect(await ledgerMatches(acc)).toBe(true);
    });

    it("can't book the spa without the money", async () => {
      const { acc, arrived } = await playerAt("thames_house", at(11));
      await pool().query("UPDATE characters SET cash_pence = 1000 WHERE account_id = $1", [acc]);
      const s = await state(acc, arrived);
      expect(action(s, "spa_massage").reason).toMatch(/Costs £35/);
      await expect(cmd(acc, "StartActivity", { activityId: "spa_massage" }, arrived)).rejects.toThrow(/Costs £35/);
      expect(await cash(acc, arrived)).toBe(1000);
    });
  });

  it("civic venues close on time", async () => {
    const { acc, arrived } = await playerAt("justice_hall", at(16));
    const evening = at(17, 30);
    const s = await state(acc, evening);
    expect(action(s, "courts_tour").reason).toMatch(/closed/i);
    await expect(cmd(acc, "StartActivity", { activityId: "law_library_reading" }, evening)).rejects.toThrow(/closed/i);
    expect(arrived.getTime()).toBeLessThan(evening.getTime());
  });

  it("pays the bike repair practice job at most three times a day", async () => {
    const { acc, arrived } = await playerAt("pedal_patch", at(10));
    const before = await cash(acc, arrived);
    let t = arrived;
    for (let i = 0; i < 3; i++) {
      await cmd(acc, "StartActivity", { activityId: "bike_repair_job" }, t);
      t = minutes(t, 7);
      await state(acc, t);
    }
    await expect(cmd(acc, "StartActivity", { activityId: "bike_repair_job" }, t)).rejects.toThrow(/Limit of 3 per day/);
    expect((await cash(acc, t)) - before).toBe(3 * 1600);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
