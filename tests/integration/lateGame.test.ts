import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { insuranceWeek } from "@/server/lateGame";
import { HARDSHIP, POLICIES, PET_RULES, hazardFor, premiumFor, uninsuredShare, vehicleDef, vehicleResale, type HazardKind } from "@/content/lateGame";
import { journeyQuote } from "@/content/world";
import { DECOR_MOOD_CAP } from "@/content/balance";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London — just after the weekly 09:00 charge time.
const T0 = new Date("2026-10-10T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const hours = (base: Date, h: number) => new Date(base.getTime() + h * 3_600_000);
const RICH = 0.99; // inherited wealth: owns a one-bed flat in Camden, so no rent muddles the sums

const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );
const charId = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;
const vehicleRow = async (id: string) => (await pool().query("SELECT * FROM vehicles WHERE id = $1", [id])).rows[0];

async function richPlayer(at = T0) {
  const acc = await makeAccount();
  await makeCharacter(acc, at, RICH);
  await setCash(acc, 10_000_000);
  return acc;
}

/** Switches off seeded incidents for a test that's about something else and spans several weeks. */
async function quietWeeks(acc: string) {
  await state(acc, T0);
  await pool().query("UPDATE late_game_state SET hazards_checked_until = $2 WHERE character_id = $1", [await charId(acc), new Date("2100-01-01T00:00:00Z")]);
}

/** Buys a vehicle and returns its id once delivered. */
async function ownVehicle(acc: string, defId: string, at: Date) {
  await cmd(acc, "BuyVehicle", { defId }, at);
  const s = await state(acc, minutes(at, 31));
  return s.garage.vehicles.filter((v: any) => v.defId === defId).at(-1).id as string;
}

/** First insurance week (from about a week after creation) whose seeded incident is of `kind`. */
async function findIncidentWeek(acc: string, kind: HazardKind) {
  const id = await charId(acc);
  let week = insuranceWeek(days(8));
  for (let i = 0; i < 400; i++) {
    const roll = hazardFor(id, week.key, week.start);
    if (roll?.kind === kind) return { roll, week };
    week = insuranceWeek(week.end);
  }
  throw new Error("no incident week found");
}

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("M5 · vehicles", () => {
  it("delivers a bought bicycle home, then offers a free ride that's faster than walking", async () => {
    const acc = await richPlayer();
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "BuyVehicle", { defId: "bicycle" }, T0);
    let s = await state(acc, minutes(T0, 5));
    expect(before - s.wallet.cashPence).toBe(vehicleDef("bicycle")!.pricePence);
    expect(s.garage.vehicles[0].delivered).toBe(false);
    const office = s.directory.find((d: any) => d.id === "city_office");
    expect(office.quotes.map((q: any) => q.mode)).not.toContain("cycle");
    await expect(cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, minutes(T0, 5))).rejects.toThrow(/being delivered/);

    s = await state(acc, minutes(T0, 31));
    const quotes = s.directory.find((d: any) => d.id === "city_office").quotes;
    const cycle = quotes.find((q: any) => q.mode === "cycle");
    const walk = quotes.find((q: any) => q.mode === "walk");
    expect(cycle.farePence).toBe(0);
    expect(cycle.minutes).toBeLessThan(walk.minutes);
    expect(quotes.map((q: any) => q.mode)).not.toContain("drive");

    await cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, minutes(T0, 31));
    s = await state(acc, minutes(T0, 32));
    expect(s.journey.mode).toBe("cycle");
    expect(s.garage.riding.defId).toBe("bicycle");
    expect(s.garage.vehicles[0].condition).toBe(100 - vehicleDef("bicycle")!.wearPerTrip);
    s = await state(acc, minutes(T0, 31 + cycle.minutes + 1));
    expect(s.character.location).toBe("city_office");
    expect(s.garage.vehicles[0].location).toBe("city_office");
    expect(s.garage.riding).toBeNull();
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("keeps the bike where you left it and back at the start if you turn round", async () => {
    const acc = await richPlayer();
    const bike = await ownVehicle(acc, "bicycle", T0);
    const t = minutes(T0, 31);
    await cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, t);
    await cmd(acc, "CancelJourney", {}, minutes(t, 2));
    let s = await state(acc, minutes(t, 3));
    expect(s.character.location).toBe("home");
    expect((await vehicleRow(bike)).location).toBe("home");
    expect((await vehicleRow(bike)).journey_id).toBeNull();
    // Walk to the food hall without it: it stays at home and can't be ridden from there.
    await cmd(acc, "StartJourney", { destination: "food_hall", mode: "walk" }, minutes(t, 3));
    s = await state(acc, minutes(t, 20));
    expect(s.character.location).toBe("food_hall");
    expect(s.directory.find((d: any) => d.id === "home").quotes.map((q: any) => q.mode)).not.toContain("cycle");
    await expect(cmd(acc, "StartJourney", { destination: "home", mode: "cycle" }, minutes(t, 20))).rejects.toThrow(/parked at Home/);
  });

  it("drives faster than the bus for a small fuel cost, and rejects modes you don't own", async () => {
    const acc = await richPlayer();
    await expect(cmd(acc, "StartJourney", { destination: "city_office", mode: "drive" }, T0)).rejects.toThrow(/don't own a car/);
    await ownVehicle(acc, "compact_car", T0);
    const t = minutes(T0, 31);
    const s = await state(acc, t);
    const quotes = s.directory.find((d: any) => d.id === "city_office").quotes;
    const drive = quotes.find((q: any) => q.mode === "drive");
    expect(drive.minutes).toBeLessThan(quotes.find((q: any) => q.mode === "bus").minutes);
    expect(drive.farePence).toBe(vehicleDef("compact_car")!.tripPence);
    await cmd(acc, "StartJourney", { destination: "city_office", mode: "drive" }, t);
    const after = await state(acc, minutes(t, 1));
    expect(s.wallet.cashPence - after.wallet.cashPence).toBe(drive.farePence);
    expect(journeyQuote("home", "city_office", "drive").minutes).toBe(drive.minutes);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("can't be used below 30% condition until serviced, and the service is prorated", async () => {
    const acc = await richPlayer();
    const bike = await ownVehicle(acc, "bicycle", T0);
    await pool().query("UPDATE vehicles SET condition = 25 WHERE id = $1", [bike]);
    const t = minutes(T0, 40);
    let s = await state(acc, t);
    expect(s.garage.vehicles[0].usableHere).toBe(false);
    expect(s.directory.find((d: any) => d.id === "city_office").quotes.map((q: any) => q.mode)).not.toContain("cycle");
    await expect(cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, t)).rejects.toThrow(/needs a service/);
    const cash = s.wallet.cashPence;
    await cmd(acc, "ServiceVehicle", { vehicleId: bike }, t);
    s = await state(acc, t);
    expect(cash - s.wallet.cashPence).toBe(Math.ceil(vehicleDef("bicycle")!.servicePence * 0.75));
    expect(s.garage.vehicles[0].condition).toBe(100);
    await expect(cmd(acc, "ServiceVehicle", { vehicleId: bike }, t)).rejects.toThrow(/perfect condition/);
    await cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, t);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("sells for about 60% once, never mid-journey, and caps the garage at ten", async () => {
    const acc = await richPlayer();
    const bike = await ownVehicle(acc, "bicycle", T0);
    const t = minutes(T0, 31);
    await cmd(acc, "StartJourney", { destination: "city_office", mode: "cycle" }, t);
    await expect(cmd(acc, "SellVehicle", { vehicleId: bike }, minutes(t, 1))).rejects.toThrow(/mid-journey/);
    const t2 = minutes(t, 40);
    let s = await state(acc, t2);
    const cash = s.wallet.cashPence;
    const cond = s.garage.vehicles[0].condition;
    await cmd(acc, "SellVehicle", { vehicleId: bike }, t2);
    s = await state(acc, t2);
    expect(s.wallet.cashPence - cash).toBe(vehicleResale(vehicleDef("bicycle")!.pricePence, cond));
    expect(vehicleResale(10000, 100)).toBe(6000);
    await expect(cmd(acc, "SellVehicle", { vehicleId: bike }, t2)).rejects.toThrow(/don't own/);
    for (let i = 0; i < 10; i++) await cmd(acc, "BuyVehicle", { defId: "bicycle" }, t2);
    await expect(cmd(acc, "BuyVehicle", { defId: "bicycle" }, t2)).rejects.toThrow(/up to 10/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("refuses a purchase you can't afford, without a partial debit", async () => {
    const acc = await makeAccount();
    await makeCharacter(acc, T0);
    await setCash(acc, 1000);
    await expect(cmd(acc, "BuyVehicle", { defId: "family_car" }, T0)).rejects.toThrow(/You need/);
    await expect(cmd(acc, "BuyVehicle", { defId: "jet" }, T0)).rejects.toThrow(/Unknown vehicle/);
    const s = await state(acc, T0);
    expect(s.garage.vehicles).toHaveLength(0);
    expect(s.wallet.cashPence).toBe(1000);
  });

  it("charges weekly upkeep once with rent, and keeps an unpaid vehicle off the road until settled", async () => {
    const acc = await richPlayer();
    await quietWeeks(acc);
    const car = await ownVehicle(acc, "compact_car", T0);
    const bike = await ownVehicle(acc, "bicycle", minutes(T0, 40));
    let s = await state(acc, days(6.9));
    const cash = s.wallet.cashPence;
    s = await state(acc, days(7.1));
    const upkeep = vehicleDef("compact_car")!.upkeepPence + vehicleDef("bicycle")!.upkeepPence;
    expect(cash - s.wallet.cashPence).toBe(upkeep);
    expect(s.bank.bills.filter((b: any) => b.description.startsWith("Vehicle upkeep"))).toHaveLength(1);
    await state(acc, days(7.2));
    s = await state(acc, days(8));
    expect(cash - s.wallet.cashPence).toBe(upkeep);

    // Next week only the bike's upkeep can be paid; the car goes off the road.
    await setCash(acc, 400);
    s = await state(acc, days(14.1));
    const carView = s.garage.vehicles.find((v: any) => v.id === car);
    expect(carView.owedPence).toBe(vehicleDef("compact_car")!.upkeepPence);
    expect(s.garage.vehicles.find((v: any) => v.id === bike).owedPence).toBe(0);
    expect(s.wallet.cashPence).toBe(100);
    await expect(cmd(acc, "StartJourney", { destination: "city_office", mode: "drive" }, days(14.1))).rejects.toThrow(/off the road/);
    await expect(cmd(acc, "PayVehicleUpkeep", { vehicleId: car }, days(14.1))).rejects.toThrow(/You need/);
    await setCash(acc, 10000);
    await cmd(acc, "PayVehicleUpkeep", { vehicleId: car }, days(14.1));
    await expect(cmd(acc, "PayVehicleUpkeep", { vehicleId: car }, days(14.1))).rejects.toThrow(/Nothing is owed/);
    await cmd(acc, "StartJourney", { destination: "city_office", mode: "drive" }, days(14.1));
    expect(await ledgerMatches(acc)).toBe(true);
  });
});

describe("M5 · insurance", () => {
  it("charges this week's premium on purchase, renews on Saturday from the next forecast, and rejects a duplicate", async () => {
    const acc = await richPlayer();
    const t = days(1);
    const s0 = await state(acc, t);
    await cmd(acc, "BuyInsurance", { kind: "home" }, t);
    let s = await state(acc, t);
    const week = insuranceWeek(t);
    expect(s0.wallet.cashPence - s.wallet.cashPence).toBe(premiumFor("home", week.key));
    expect(s.insurance.policies.find((p: any) => p.kind === "home").active).toBe(true);
    await expect(cmd(acc, "BuyInsurance", { kind: "home" }, t)).rejects.toThrow(/already have/);
    await expect(cmd(acc, "BuyInsurance", { kind: "pets" }, t)).rejects.toThrow(/Unknown policy/);
    const cash = s.wallet.cashPence;
    s = await state(acc, days(7.1));
    expect(cash - s.wallet.cashPence).toBe(premiumFor("home", insuranceWeek(days(7.1)).key));
    await state(acc, days(7.5));
    s = await state(acc, days(8));
    expect(cash - s.wallet.cashPence).toBe(premiumFor("home", insuranceWeek(days(7.1)).key));
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("lapses when the premium can't be paid, and a cancelled policy covers to the week's end without renewing", async () => {
    const acc = await richPlayer();
    await cmd(acc, "BuyInsurance", { kind: "home" }, days(1));
    await cmd(acc, "BuyInsurance", { kind: "possessions" }, days(1));
    await cmd(acc, "CancelInsurance", { kind: "possessions" }, days(2));
    await expect(cmd(acc, "CancelInsurance", { kind: "possessions" }, days(2))).rejects.toThrow(/don't have/);
    let s = await state(acc, days(3));
    const poss = s.insurance.policies.find((p: any) => p.kind === "possessions");
    expect(poss.active).toBe(true);
    expect(poss.renews).toBe(false);
    expect(poss.coveredUntil).toBe(insuranceWeek(days(3)).end.toISOString());
    await setCash(acc, 0);
    s = await state(acc, days(7.1));
    expect(s.notices.join(" ")).toMatch(/home cover lapsed/);
    expect(s.insurance.policies.every((p: any) => !p.active && !p.renews)).toBe(true);
    expect(s.wallet.cashPence).toBe(0);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("pays an insured incident once, minus the excess, for cover bought just before it", async () => {
    const acc = await richPlayer();
    await cmd(acc, "BuyFurniture", { defId: "original_artwork" }, T0); // something worth protecting
    const { roll } = await findIncidentWeek(acc, "burst_pipe");
    await state(acc, hours(roll.at, -2));
    await setCash(acc, 100_000);
    await cmd(acc, "BuyInsurance", { kind: "home" }, minutes(roll.at, -1));
    let s = await state(acc, minutes(roll.at, 1));
    const inc = s.insurance.incidents[0];
    expect(inc.kind).toBe("burst_pipe");
    expect(inc.insured).toBe(true);
    expect(inc.chargedPence).toBe(roll.lossPence);
    expect(inc.payoutPence).toBe(Math.max(0, roll.lossPence - POLICIES.home.excessPence));
    // Reloading never records it twice.
    await state(acc, minutes(roll.at, 5));
    expect((await pool().query("SELECT count(*) AS n FROM hazard_events WHERE occurred_at = $1", [roll.at])).rows[0].n).toBe("1");

    const before = (await state(acc, minutes(roll.at, 2))).wallet.cashPence;
    const k = key();
    await cmd(acc, "ClaimInsurance", { eventId: inc.id }, minutes(roll.at, 2), k);
    const replay = await cmd(acc, "ClaimInsurance", { eventId: inc.id }, minutes(roll.at, 2), k);
    expect(replay.replayed).toBe(true);
    await expect(cmd(acc, "ClaimInsurance", { eventId: inc.id }, minutes(roll.at, 3))).rejects.toThrow(/already been paid/);
    s = await state(acc, minutes(roll.at, 3));
    expect(s.wallet.cashPence - before).toBe(inc.payoutPence);
    expect(s.insurance.incidents[0].claimable).toBe(false);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("never covers an incident retroactively, and caps an uninsured low earner's loss with hardship relief", async () => {
    const acc = await richPlayer();
    await cmd(acc, "BuyFurniture", { defId: "original_artwork" }, T0);
    const { roll } = await findIncidentWeek(acc, "phone_snatched");
    await state(acc, hours(roll.at, -1));
    await setCash(acc, 100_000);
    // Bought a minute after it happened: settlement records the incident first, uncovered.
    await cmd(acc, "BuyInsurance", { kind: "possessions" }, minutes(roll.at, 1));
    const s = await state(acc, minutes(roll.at, 2));
    const inc = s.insurance.incidents[0];
    expect(inc.insured).toBe(false);
    const share = uninsuredShare(roll.lossPence, true);
    expect(share).toBe(Math.round(Math.min(roll.lossPence, HARDSHIP.uninsuredCapPence) * HARDSHIP.lowIncomeShare));
    expect(inc.chargedPence).toBe(share);
    expect(inc.reliefPence).toBe(roll.lossPence - share);
    await expect(cmd(acc, "ClaimInsurance", { eventId: inc.id }, minutes(roll.at, 3))).rejects.toThrow(/weren't covered/);
    await expect(cmd(acc, "ClaimInsurance", { eventId: "00000000-0000-0000-0000-000000000000" }, minutes(roll.at, 3))).rejects.toThrow(/isn't on your record/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("never pushes a player below zero: an unaffordable loss is forgiven", async () => {
    const acc = await richPlayer();
    await cmd(acc, "BuyFurniture", { defId: "original_artwork" }, T0);
    const { roll } = await findIncidentWeek(acc, "burst_pipe");
    await state(acc, hours(roll.at, -1));
    await setCash(acc, 300);
    const s = await state(acc, minutes(roll.at, 1));
    const inc = s.insurance.incidents[0];
    expect(inc.chargedPence).toBeLessThanOrEqual(300);
    expect(s.wallet.cashPence).toBeGreaterThanOrEqual(0);
    expect(inc.chargedPence + inc.reliefPence).toBe(roll.lossPence);
  });

  it("covers a stolen bike under possessions cover", async () => {
    const acc = await richPlayer();
    const { roll } = await findIncidentWeek(acc, "bike_stolen");
    await state(acc, hours(roll.at, -3));
    const bike = await ownVehicle(acc, "bicycle", hours(roll.at, -2));
    await cmd(acc, "BuyInsurance", { kind: "possessions" }, hours(roll.at, -1));
    const s = await state(acc, minutes(roll.at, 1));
    const inc = s.insurance.incidents[0];
    expect(inc.kind).toBe("bike_stolen");
    expect(inc.insured).toBe(true);
    expect((await vehicleRow(bike)).status).toBe("stolen");
    expect(s.garage.vehicles).toHaveLength(0);
    const value = vehicleResale(vehicleDef("bicycle")!.pricePence, 100);
    expect(inc.itemValuePence).toBe(value);
    expect(inc.payoutPence).toBe(value - POLICIES.possessions.excessPence);
  });

  it("spares players without late-game assets, and newcomers in their first week", async () => {
    const acc = await richPlayer();
    const { roll } = await findIncidentWeek(acc, "burst_pipe");
    await state(acc, hours(roll.at, -1));
    const s = await state(acc, hours(roll.at, 1));
    expect(s.insurance.incidents).toHaveLength(0);

    // A newcomer whose first-week roll lands inside their grace week is never hit by it.
    for (let i = 0; i < 120; i++) {
      const created = hours(T0, i * 7);
      const a = await makeAccount();
      await makeCharacter(a, created, RICH);
      const id = await charId(a);
      const week = insuranceWeek(created);
      const r = hazardFor(id, week.key, week.start);
      if (!r || r.kind === "bike_stolen" || r.at <= minutes(created, 40)) continue;
      await cmd(a, "BuyFurniture", { defId: "original_artwork" }, minutes(created, 30));
      const after = await state(a, hours(r.at, 1));
      expect(after.insurance.incidents).toHaveLength(0);
      return;
    }
    throw new Error("no newcomer roll found");
  });
});

describe("M5 · pets", () => {
  it("adopts a named pet, decays wellbeing to a floor, prompts care once, and needs pet food to feed", async () => {
    const acc = await richPlayer();
    await expect(cmd(acc, "AdoptPet", { kind: "parrot", name: "Polly" }, T0)).rejects.toThrow(/cat or a dog/);
    await expect(cmd(acc, "AdoptPet", { kind: "cat", name: "" }, T0)).rejects.toThrow(/name/);
    const s0 = await state(acc, T0);
    await cmd(acc, "AdoptPet", { kind: "cat", name: "Biscuit" }, T0);
    let s = await state(acc, T0);
    expect(s0.wallet.cashPence - s.wallet.cashPence).toBe(6000);
    const pet = s.pets.list[0];
    expect(pet.name).toBe("Biscuit");
    expect(pet.wellbeing).toBe(PET_RULES.startWellbeing);

    s = await state(acc, hours(T0, 8));
    expect(s.pets.list[0].wellbeing).toBe(60);
    s = await state(acc, hours(T0, 16));
    expect(s.pets.list[0].needsCare).toBe(false);
    s = await state(acc, hours(T0, 24));
    expect(s.pets.list[0].needsCare).toBe(true);
    expect(s.notices.join(" ")).toMatch(/Biscuit could do with some attention/);
    s = await state(acc, hours(T0, 40));
    expect(s.pets.list[0].wellbeing).toBe(PET_RULES.floor);
    expect(s.notices.join(" ")).not.toMatch(/Biscuit/);

    const t = hours(T0, 40);
    await expect(cmd(acc, "CarePet", { petId: pet.id, action: "feed" }, t)).rejects.toThrow(/pet food/);
    await pool().query(
      "INSERT INTO inventory (character_id, item_id, qty) VALUES ((SELECT id FROM characters WHERE account_id = $1), 'pet_food', 2)",
      [acc],
    );
    await cmd(acc, "CarePet", { petId: pet.id, action: "feed" }, t);
    await expect(cmd(acc, "CarePet", { petId: pet.id, action: "feed" }, minutes(t, 5))).rejects.toThrow(/Try again at/);
    await expect(cmd(acc, "CarePet", { petId: pet.id, action: "dance" }, t)).rejects.toThrow(/Unknown care/);
    const fun = (await state(acc, t)).needs.fun;
    await cmd(acc, "CarePet", { petId: pet.id, action: "play" }, t);
    s = await state(acc, t);
    expect(s.pets.list[0].wellbeing).toBe(PET_RULES.floor + 35 + 20);
    expect(s.needs.fun).toBeGreaterThan(fun);
    expect(s.pets.petFood).toBe(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("only cares at home, caps the household at two, and rehomes once", async () => {
    const acc = await richPlayer();
    await cmd(acc, "AdoptPet", { kind: "dog", name: "Rex" }, T0);
    await cmd(acc, "AdoptPet", { kind: "cat", name: "Mittens" }, T0);
    await expect(cmd(acc, "AdoptPet", { kind: "cat", name: "Third" }, T0)).rejects.toThrow(/up to 2/);
    const s = await state(acc, T0);
    const rex = s.pets.list.find((p: any) => p.name === "Rex");
    await cmd(acc, "StartJourney", { destination: "food_hall", mode: "walk" }, T0);
    await expect(cmd(acc, "CarePet", { petId: rex.id, action: "play" }, minutes(T0, 1))).rejects.toThrow(/travelling/);
    await state(acc, minutes(T0, 10));
    await expect(cmd(acc, "CarePet", { petId: rex.id, action: "play" }, minutes(T0, 10))).rejects.toThrow(/Go home/);
    await cmd(acc, "RehomePet", { petId: rex.id }, minutes(T0, 10));
    await expect(cmd(acc, "RehomePet", { petId: rex.id }, minutes(T0, 10))).rejects.toThrow(/isn't living with you/);
    expect((await state(acc, minutes(T0, 11))).pets.list.map((p: any) => p.name)).toEqual(["Mittens"]);
  });
});

describe("M5 · prestige furniture", () => {
  async function placeSomewhere(acc: string, instanceId: string, at: Date) {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        for (const rot of [0, 90]) {
          try {
            await cmd(acc, "PlaceFurniture", { instanceId, x, y, rot }, at);
            return;
          } catch {
            /* try the next cell */
          }
        }
    throw new Error("no room");
  }

  it("a home cinema restores lots of Fun and the workstation trains Coding faster", async () => {
    const acc = await richPlayer();
    const cinema = await cmd(acc, "BuyFurniture", { defId: "home_cinema" }, T0);
    const ws = await cmd(acc, "BuyFurniture", { defId: "workstation" }, T0);
    let s = await state(acc, T0);
    expect(s.actions.find((a: any) => a.id === "watch_cinema").reason).toMatch(/home cinema/);
    await placeSomewhere(acc, (cinema.receipt as any).instanceId, T0);
    await placeSomewhere(acc, (ws.receipt as any).instanceId, T0);
    await pool().query("UPDATE characters SET fun = 20 WHERE account_id = $1", [acc]);
    await cmd(acc, "StartActivity", { activityId: "watch_cinema" }, T0);
    s = await state(acc, minutes(T0, 13));
    expect(s.needs.fun).toBeGreaterThanOrEqual(60);
    const xp = s.skills.find((k: any) => k.id === "coding").xp;
    await cmd(acc, "StartActivity", { activityId: "workstation_sprint" }, minutes(T0, 13));
    s = await state(acc, minutes(T0, 24));
    expect(s.skills.find((k: any) => k.id === "coding").xp - xp).toBe(30);
  });

  it("artwork adds décor, but décor mood stays capped", async () => {
    const acc = await richPlayer();
    for (const defId of ["original_artwork", "plant", "rug", "poster", "lamp"]) {
      const r = await cmd(acc, "BuyFurniture", { defId }, T0);
      await placeSomewhere(acc, (r.receipt as any).instanceId, T0);
    }
    const s = await state(acc, T0);
    const decor = s.mood.factors.find((f: any) => f.label === "Home décor");
    expect(decor.value).toBe(DECOR_MOOD_CAP);
  });
});
