import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { adWeek } from "@/server/fleets";
import { AD_SITES, FIRM, TIERS, adPrice, adSite, boardFor, contractFuel, contractWear, siteDown } from "@/content/fleets";
import { vehicleDef } from "@/content/lateGame";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London.
const T0 = new Date("2026-10-10T09:00:00Z");
const RICH = 0.99; // owns a home, so no rent muddles the sums

const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );
const charId = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;

async function richPlayer(at = T0) {
  const acc = await makeAccount();
  await makeCharacter(acc, at, RICH);
  await setCash(acc, 10_000_000);
  // Seeded incidents are about insurance, not this workstream: switch them off.
  await state(acc, at);
  await pool().query("UPDATE late_game_state SET hazards_checked_until = $2 WHERE character_id = $1", [await charId(acc), new Date("2100-01-01T00:00:00Z")]);
  return acc;
}

/** Buys a car and returns its id once it's been delivered (31 minutes later). */
async function ownCar(acc: string, defId: string, at: Date) {
  await cmd(acc, "BuyVehicle", { defId }, at);
  const s = await state(acc, minutes(at, 31));
  return s.garage.vehicles.filter((v: any) => v.defId === defId).at(-1).id as string;
}

/** A rich player with a delivered compact car and a registered firm, ready at T0 + 31 min. */
async function courier() {
  const acc = await richPlayer();
  const car = await ownCar(acc, "compact_car", T0);
  await cmd(acc, "RegisterFirm", { first: "Swift", second: "Couriers" }, minutes(T0, 31));
  return { acc, car, at: minutes(T0, 31) };
}

const openListing = (s: any, pred: (l: any) => boolean = () => true) => s.courier.board.listings.find((l: any) => l.open && pred(l));
const carRow = async (id: string) => (await pool().query("SELECT * FROM vehicles WHERE id = $1", [id])).rows[0];

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("M5 · courier firm", () => {
  it("needs a car to register, charges the fee once and allows one firm per person", async () => {
    const acc = await richPlayer();
    await expect(cmd(acc, "RegisterFirm", { first: "Swift", second: "Couriers" }, T0)).rejects.toThrow(/need a car/);
    await cmd(acc, "BuyVehicle", { defId: "bicycle" }, T0);
    await expect(cmd(acc, "RegisterFirm", { first: "Swift", second: "Couriers" }, T0)).rejects.toThrow(/need a car/);
    await cmd(acc, "BuyVehicle", { defId: "compact_car" }, T0);
    await expect(cmd(acc, "RegisterFirm", { first: "Swift", second: "hello <b>" }, T0)).rejects.toThrow(/from the lists/);
    const before = (await state(acc, T0)).wallet.cashPence;
    const k = key();
    await cmd(acc, "RegisterFirm", { first: "Kestrel", second: "Haulage" }, T0, k);
    const replay = await cmd(acc, "RegisterFirm", { first: "Kestrel", second: "Haulage" }, T0, k);
    expect(replay.replayed).toBe(true);
    const s = await state(acc, T0);
    expect(before - s.wallet.cashPence).toBe(FIRM.registrationPence);
    expect(s.courier.firm.name).toBe("Kestrel Haulage");
    expect(s.courier.firm.level).toBe(1);
    await expect(cmd(acc, "RegisterFirm", { first: "Swift", second: "Couriers" }, T0)).rejects.toThrow(/already run a courier firm/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("dispatches a car: fuel up front, wear, the car is busy, and the fee is paid exactly once on completion", async () => {
    const { acc, car, at } = await courier();
    let s = await state(acc, at);
    const l = openListing(s, (x) => x.tier === "parcel");
    const def = vehicleDef("compact_car")!;
    const fuel = contractFuel(def.tripPence, l.minutes);
    const wear = contractWear(def.wearPerTrip, l.minutes, "parcel");
    const before = s.wallet.cashPence;
    await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at);
    s = await state(acc, minutes(at, 1));
    expect(before - s.wallet.cashPence).toBe(fuel);
    expect(s.courier.running).toHaveLength(1);
    expect(s.courier.board.listings.find((x: any) => x.slot === l.slot).status).toBe("running");
    const v = s.garage.vehicles.find((x: any) => x.id === car);
    expect(v.condition).toBe(100 - wear);
    expect(v.inUse).toBe(true);
    expect(v.reason).toMatch(/courier contract/);

    // The car can't be driven, serviced or sold while it's out.
    await expect(cmd(acc, "StartJourney", { destination: "food_hall", mode: "drive" }, minutes(at, 1))).rejects.toThrow(/courier contract/);
    await expect(cmd(acc, "SellVehicle", { vehicleId: car }, minutes(at, 1))).rejects.toThrow(/courier contract/);
    await expect(cmd(acc, "ServiceVehicle", { vehicleId: car }, minutes(at, 1))).rejects.toThrow(/courier contract/);
    // The same listing can't be taken twice in a day.
    await expect(cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, minutes(at, 1))).rejects.toThrow(/already taken/);

    // Not yet finished: nothing is paid.
    s = await state(acc, minutes(at, l.minutes - 1));
    expect(s.wallet.cashPence).toBe(before - fuel);

    const done = minutes(at, l.minutes + 1);
    s = await state(acc, done);
    const paid = l.payPence - l.driverPence; // well under the weekly business-tax allowance
    expect(s.wallet.cashPence).toBe(before - fuel + paid);
    expect(s.notices.join(" ")).toMatch(/Swift Couriers delivered/);
    expect(s.courier.running).toHaveLength(0);
    expect(s.courier.recent[0]).toMatchObject({ status: "completed", paidPence: paid, taxPence: 0 });
    expect(s.courier.firm.xp).toBe(TIERS.parcel.xp);
    expect(s.courier.firm.contractsDone).toBe(1);
    expect(s.garage.vehicles.find((x: any) => x.id === car).inUse).toBe(false);
    expect((await carRow(car)).contract_id).toBeNull();

    // Loading again later never pays twice.
    s = await state(acc, minutes(done, 30));
    expect(s.wallet.cashPence).toBe(before - fuel + paid);
    const ledger = await pool().query("SELECT count(*) AS n FROM ledger_entries WHERE ref_type = 'courier_contract' AND amount_pence > 0 AND character_id = $1", [await charId(acc)]);
    expect(Number(ledger.rows[0].n)).toBe(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("replays a retried dispatch without charging fuel twice", async () => {
    const { acc, car, at } = await courier();
    const s = await state(acc, at);
    const l = openListing(s);
    const k = key();
    await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at, k);
    const again = await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at, k);
    expect(again.replayed).toBe(true);
    const n = await pool().query("SELECT count(*) AS n FROM courier_contracts WHERE character_id = $1", [await charId(acc)]);
    expect(Number(n.rows[0].n)).toBe(1);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("lets one car run one contract at a time, even when two dispatches race", async () => {
    const { acc, car, at } = await courier();
    const s = await state(acc, at);
    const [a, b] = s.courier.board.listings.filter((l: any) => l.open);
    const results = await Promise.allSettled([cmd(acc, "StartContract", { slot: a.slot, vehicleId: car }, at), cmd(acc, "StartContract", { slot: b.slot, vehicleId: car }, at)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/already out on a contract/);
  });

  it("limits contracts per day by cars and level; more cars raise the limit", async () => {
    const { acc, car, at } = await courier();
    let s = await state(acc, at);
    expect(s.courier.firm.limit).toBe(FIRM.contractsPerCar);
    let t = at;
    for (let i = 0; i < FIRM.contractsPerCar; i++) {
      const l = openListing(s, (x) => x.tier === "parcel" || x.tier === "priority");
      await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, t);
      t = minutes(t, l.minutes + 1);
      s = await state(acc, t);
    }
    const third = openListing(s);
    await expect(cmd(acc, "StartContract", { slot: third.slot, vehicleId: car }, t)).rejects.toThrow(/2 contracts a day/);
    const car2 = await ownCar(acc, "family_car", t);
    t = minutes(t, 31);
    s = await state(acc, t);
    expect(s.courier.firm.limit).toBe(2 * FIRM.contractsPerCar);
    const l = openListing(s);
    await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car2 }, t);
    expect((await state(acc, t)).courier.firm.usedToday).toBe(3);
  });

  it("locks better contracts behind firm level and boot space", async () => {
    const { acc, car, at } = await courier();
    const s = await state(acc, at);
    const haul = s.courier.board.listings.find((l: any) => l.tier === "haulage" && !l.status);
    expect(haul.open).toBe(false);
    expect(haul.reason).toMatch(/level 3/);
    await expect(cmd(acc, "StartContract", { slot: haul.slot, vehicleId: car }, at)).rejects.toThrow(/unlock at firm level 3/);
    await pool().query("UPDATE courier_firms SET level = 3, xp = 24 WHERE character_id = $1", [await charId(acc)]);
    const s2 = await state(acc, at);
    const haul2 = openListing(s2, (l) => l.tier === "haulage");
    await expect(cmd(acc, "StartContract", { slot: haul2.slot, vehicleId: car }, at)).rejects.toThrow(/boot space/);
    const family = await ownCar(acc, "family_car", at);
    await cmd(acc, "StartContract", { slot: haul2.slot, vehicleId: family }, minutes(at, 31));
    await expect(cmd(acc, "StartContract", { slot: 99, vehicleId: car }, minutes(at, 31))).rejects.toThrow(/isn't on today's board/);
  });

  it("refuses a run that can't make its deadline", async () => {
    const { acc, car } = await courier();
    const l = boardFor("2026-10-10").find((x) => x.tier === "parcel" && x.minutes >= 4)!;
    // Halfway through the time it needs, before the deadline.
    const deadline = new Date(Date.UTC(2026, 9, 10, l.deadlineHour - 1)); // BST: London hour - 1 = UTC
    const late = minutes(deadline, -Math.floor(l.minutes / 2));
    const s = await state(acc, late);
    expect(s.courier.board.listings.find((x: any) => x.slot === l.slot).reason).toMatch(/Too late/);
    await expect(cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, late)).rejects.toThrow(/Too late/);
  });

  it("calls a car back: no fee, no fuel refund, the car is free and the run still counts", async () => {
    const { acc, car, at } = await courier();
    let s = await state(acc, at);
    const l = openListing(s);
    await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at);
    const afterFuel = (await state(acc, at)).wallet.cashPence;
    const id = (await state(acc, at)).courier.running[0].id;
    await cmd(acc, "AbandonContract", { contractId: id }, minutes(at, 2));
    await expect(cmd(acc, "AbandonContract", { contractId: id }, minutes(at, 3))).rejects.toThrow(/already finished/);
    s = await state(acc, minutes(at, l.minutes + 5));
    expect(s.wallet.cashPence).toBe(afterFuel);
    expect(s.courier.recent[0].status).toBe("abandoned");
    expect(s.courier.firm.usedToday).toBe(1);
    expect(s.courier.firm.xp).toBe(0);
    expect(s.garage.vehicles.find((x: any) => x.id === car).inUse).toBe(false);
    await expect(cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, minutes(at, l.minutes + 5))).rejects.toThrow(/already taken/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("keeps firms separate: nobody can use, call back or be paid for another player's contract", async () => {
    const a = await courier();
    const b = await courier();
    const sa = await state(a.acc, a.at);
    const l = openListing(sa);
    // Same daily board for everyone; each firm can run each listing once.
    await cmd(a.acc, "StartContract", { slot: l.slot, vehicleId: a.car }, a.at);
    await cmd(b.acc, "StartContract", { slot: l.slot, vehicleId: b.car }, b.at);
    const aId = (await state(a.acc, a.at)).courier.running[0].id;
    await expect(cmd(b.acc, "AbandonContract", { contractId: aId }, minutes(a.at, 1))).rejects.toThrow(/isn't one of yours/);
    const l2 = openListing(await state(b.acc, b.at));
    await expect(cmd(b.acc, "StartContract", { slot: l2.slot, vehicleId: a.car }, b.at)).rejects.toThrow(/don't own that vehicle/);
    const cashB = (await state(b.acc, b.at)).wallet.cashPence;
    await state(a.acc, minutes(a.at, l.minutes + 1));
    const sb = await state(b.acc, minutes(b.at, l.minutes + 1));
    expect(sb.wallet.cashPence).toBe(cashB + l.payPence - l.driverPence);
    expect(await ledgerMatches(a.acc)).toBe(true);
    expect(await ledgerMatches(b.acc)).toBe(true);
  });

  it("won't dispatch a car that's unsafe or owes upkeep, and levels the firm up with experience", async () => {
    const { acc, car, at } = await courier();
    await pool().query("UPDATE vehicles SET condition = 20 WHERE id = $1", [car]);
    let s = await state(acc, at);
    const l = openListing(s);
    await expect(cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at)).rejects.toThrow(/needs a service/);
    await pool().query("UPDATE vehicles SET condition = 100, owed_pence = 4500 WHERE id = $1", [car]);
    await expect(cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at)).rejects.toThrow(/upkeep is paid/);
    await pool().query("UPDATE vehicles SET owed_pence = 0 WHERE id = $1", [car]);
    await pool().query("UPDATE courier_firms SET xp = 7 WHERE character_id = $1", [await charId(acc)]);
    await cmd(acc, "StartContract", { slot: l.slot, vehicleId: car }, at);
    s = await state(acc, minutes(at, l.minutes + 1));
    expect(s.courier.firm.level).toBe(2);
    expect(s.notices.join(" ")).toMatch(/reached level 2/);
  });
});

describe("M5 · city advertising", () => {
  const design = { template: "bold", colour: "racing", slogan: "kettle", brand: "name" };

  it("sells the rest of this week at a prorated price and shows the ad to every player at once", async () => {
    const acc = await richPlayer();
    const viewer = await richPlayer();
    const site = AD_SITES.find((x) => !siteDown(x.id, adWeek(T0).key))!;
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "BookAd", { siteId: site.id, week: "this", ...design }, T0);
    const s = await state(acc, T0);
    const price = adPrice(site, adWeek(T0).end.getTime() - T0.getTime());
    expect(price).toBeLessThan(site.pricePence);
    expect(before - s.wallet.cashPence).toBe(price);
    expect(s.ads.mine[0]).toMatchObject({ siteId: site.id, status: "live", brand: "Ada", slogan: "Put the kettle on. We've got this.", cancellable: false });
    const v = await state(viewer, T0);
    expect(v.ads.live[site.id]).toHaveLength(1);
    expect(v.ads.live[site.id][0]).toEqual({ id: expect.any(String), template: "bold", colour: "#234C42", slogan: "Put the kettle on. We've got this.", brand: "Ada" });
    // No account or character ids are exposed with the ad.
    expect(JSON.stringify(v.ads.live)).not.toContain(await charId(acc));
    // On show: no refund.
    await expect(cmd(acc, "CancelAd", { bookingId: s.ads.mine[0].id }, minutes(T0, 5))).rejects.toThrow(/already on show/);
    // After the week it expires everywhere.
    const after = adWeek(T0).end;
    expect((await state(viewer, after)).ads.live[site.id]).toHaveLength(0);
    expect((await state(acc, after)).ads.mine[0].status).toBe("expired");
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("refunds a booking cancelled before its week starts, and only once", async () => {
    const acc = await richPlayer();
    const before = (await state(acc, T0)).wallet.cashPence;
    await cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design }, T0);
    let s = await state(acc, T0);
    expect(before - s.wallet.cashPence).toBe(adSite("high_street")!.pricePence);
    expect(s.ads.mine[0]).toMatchObject({ status: "scheduled", cancellable: true });
    await cmd(acc, "CancelAd", { bookingId: s.ads.mine[0].id }, minutes(T0, 1));
    await expect(cmd(acc, "CancelAd", { bookingId: s.ads.mine[0].id }, minutes(T0, 2))).rejects.toThrow(/already ended/);
    s = await state(acc, minutes(T0, 2));
    expect(s.wallet.cashPence).toBe(before);
    expect(s.ads.mine[0].status).toBe("cancelled");
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("sells a site's slots atomically: simultaneous buyers never oversell a week", async () => {
    const site = adSite("south_bank")!;
    const buyers = await Promise.all(Array.from({ length: site.slots + 2 }, () => richPlayer()));
    const results = await Promise.allSettled(buyers.map((b) => cmd(b, "BookAd", { siteId: site.id, week: "next", ...design }, T0)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(site.slots);
    for (const r of results.filter((x) => x.status === "rejected")) expect(String((r as PromiseRejectedResult).reason)).toMatch(/sold for that week/);
    const rows = await pool().query("SELECT slot FROM ad_bookings WHERE site_id = $1 AND status = 'booked' ORDER BY slot", [site.id]);
    expect(rows.rows.map((r) => r.slot)).toEqual(Array.from({ length: site.slots }, (_, i) => i));
    const s = await state(buyers[0], T0);
    expect(s.ads.sites.find((x: any) => x.id === site.id).nextWeek.left).toBe(0);
    for (const b of buyers) expect(await ledgerMatches(b)).toBe(true);
  });

  it("only accepts preset designs and enforces per-player limits", async () => {
    const acc = await richPlayer();
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, slogan: "Visit http://example.com" }, T0)).rejects.toThrow(/from the lists/);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, template: "<script>" }, T0)).rejects.toThrow(/from the lists/);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, colour: "#ff00ff" }, T0)).rejects.toThrow(/from the lists/);
    await expect(cmd(acc, "BookAd", { siteId: "nowhere", week: "next", ...design }, T0)).rejects.toThrow(/Unknown advertising site/);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "later", ...design }, T0)).rejects.toThrow(/this week or next/);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, brand: "firm" }, T0)).rejects.toThrow(/Register a courier firm/);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, brand: "Buy my stuff" }, T0)).rejects.toThrow(/whose ad/);
    await cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design }, T0);
    await expect(cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design }, T0)).rejects.toThrow(/already have an ad/);
    await cmd(acc, "BookAd", { siteId: "regents_green", week: "next", ...design }, T0);
    await expect(cmd(acc, "BookAd", { siteId: "stadium", week: "next", ...design }, T0)).rejects.toThrow(/up to 2 ads/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("advertises a courier firm under its preset name", async () => {
    const { acc, at } = await courier();
    await cmd(acc, "BookAd", { siteId: "high_street", week: "next", ...design, brand: "firm" }, at);
    expect((await state(acc, at)).ads.mine[0].brand).toBe("Swift Couriers");
  });

  it("refunds in full, once, when the site turns out to be out of use for the booked week", async () => {
    // Find the first future week in which some site is down.
    let week = adWeek(adWeek(T0).end);
    let site: string | undefined;
    for (let i = 0; i < 300 && !site; i++) {
      site = AD_SITES.find((x) => siteDown(x.id, week.key))?.id;
      if (!site) week = adWeek(week.end);
    }
    expect(site).toBeDefined();
    const bookAt = new Date(week.start.getTime() - 2 * 86_400_000);
    const acc = await richPlayer(bookAt);
    const viewer = await richPlayer(bookAt);
    const before = (await state(acc, bookAt)).wallet.cashPence;
    await cmd(acc, "BookAd", { siteId: site, week: "next", ...design }, bookAt);
    expect((await state(acc, bookAt)).wallet.cashPence).toBe(before - adSite(site!)!.pricePence);

    const during = new Date(week.start.getTime() + 3_600_000);
    // Never shown to anyone while the site is down, even before the advertiser next plays.
    expect((await state(viewer, during)).ads.live[site!]).toHaveLength(0);
    let s = await state(acc, during);
    expect(s.wallet.cashPence).toBe(before);
    expect(s.notices.join(" ")).toMatch(/couldn't be shown/);
    expect(s.ads.mine[0]).toMatchObject({ status: "refunded" });
    expect(s.ads.sites.find((x: any) => x.id === site).thisWeek.down).toBeTruthy();
    // Booking the rest of that week on that site is refused up front.
    await expect(cmd(viewer, "BookAd", { siteId: site, week: "this", ...design }, during)).rejects.toThrow(/can't show ads this week/);
    s = await state(acc, minutes(during, 60));
    expect(s.wallet.cashPence).toBe(before);
    expect(await ledgerMatches(acc)).toBe(true);
  });
});
