import crypto from "node:crypto";
import {
  AD_COLOURS,
  AD_RULES,
  AD_SITES,
  AD_SLOGANS,
  AD_TEMPLATES,
  FIRM,
  FIRM_LEVELS,
  FIRM_MAX_LEVEL,
  FIRM_NAME_FIRST,
  FIRM_NAME_SECOND,
  TIERS,
  adPrice,
  adSite,
  boardFor,
  cargoOf,
  colourHex,
  contractFuel,
  contractWear,
  dailyContractLimit,
  firmLevelFor,
  firmName,
  listingTitle,
  siteDown,
  sloganText,
  type AdBrand,
  type ContractTier,
} from "@/content/fleets";
import { VEHICLES, VEHICLE_RULES, vehicleDef } from "@/content/lateGame";
import { businessTax } from "@/content/market";
import { venue } from "@/content/world";
import { londonWeekKey } from "@/sim/shift";
import { durationMs, londonClock, londonDayKey, londonInstant, nextLondonWeekly } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

/**
 * Milestone 5 · Transport company and city advertising (spec ch. 17, 27).
 *
 * Courier firm: anyone who owns a car can register one. Each London day has one seeded contract board; a
 * firm dispatches a car on a listing, paying fuel up front, and the fee (less the driver's wage and weekly
 * business tax) is paid once when the run completes. The car is busy until then.
 *
 * Advertising: weekly billboard slots (Monday 00:00 to Monday 00:00 London) sold atomically per site, designed
 * only from preset templates, colours and slogans. A booking is refunded only if it was never shown: cancelled
 * before the week starts, or the site turned out to be out of use that week.
 */

const DAY_MS = 86_400_000;
const CAR_IDS = VEHICLES.filter((v) => v.mode === "drive").map((v) => v.id);

// ───────────────────────────── time ─────────────────────────────

/** The advertising week containing `at`: Monday 00:00 London (inclusive) to the next Monday. */
export function adWeek(at: Date) {
  let start = nextLondonWeekly(new Date(at.getTime() - 8 * DAY_MS), 1, 0);
  for (let guard = 0; guard < 3; guard++) {
    const next = nextLondonWeekly(start, 1, 0);
    if (next.getTime() > at.getTime()) break;
    start = next;
  }
  return { start, end: nextLondonWeekly(start, 1, 0), key: londonWeekKey(start) };
}

// ───────────────────────────── helpers ─────────────────────────────

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function firmOf(tx: Tx, charId: string, lock = false): Promise<Row | null> {
  return (await tx.query(`SELECT * FROM courier_firms WHERE character_id = $1${lock ? " FOR UPDATE" : ""}`, [charId])).rows[0] ?? null;
}

async function carsOf(tx: Tx, charId: string): Promise<Row[]> {
  return (await tx.query("SELECT * FROM vehicles WHERE character_id = $1 AND status = 'owned' AND def_id = ANY($2) ORDER BY bought_at, id", [charId, CAR_IDS])).rows;
}

/** Why a car can't be dispatched right now, or null. */
function carBlocker(v: Row, now: Date): string | null {
  const name = vehicleDef(String(v.def_id))?.name.toLowerCase() ?? "car";
  if (new Date(v.delivered_at) > now) return `Your ${name} is still being delivered.`;
  if (v.contract_id) return `Your ${name} is already out on a contract.`;
  if (v.journey_id) return `Your ${name} is on the road with you.`;
  if (Number(v.owed_pence) > 0) return `Your ${name} is off the road until its upkeep is paid (Vehicles app).`;
  if (Number(v.condition) < VEHICLE_RULES.minCondition) return `Your ${name} needs a service first (condition ${v.condition}%).`;
  return null;
}

const deliveredCars = (cars: Row[], now: Date) => cars.filter((v) => new Date(v.delivered_at) <= now).length;

async function startedOn(tx: Tx, firmId: string, day: string) {
  return Number((await tx.query("SELECT count(*) AS n FROM courier_contracts WHERE firm_id = $1 AND day_key = $2", [firmId, day])).rows[0].n);
}

// ───────────────────────────── settlement ─────────────────────────────

/**
 * Runs with every settlement: pays out each courier run that has finished (once: the status flip is the
 * guard), and refunds booked ads whose week has started on a site that turned out to be out of use.
 */
export async function settleFleets(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const due = (await tx.query("SELECT * FROM courier_contracts WHERE character_id = $1 AND status = 'running' AND ends_at <= $2 ORDER BY ends_at, id", [c.id, now])).rows;
  for (const k of due) {
    const claimed = await tx.query("UPDATE courier_contracts SET status = 'completed', settled_at = ends_at WHERE id = $1 AND status = 'running' RETURNING id", [k.id]);
    if (!claimed.rowCount) continue;
    const firm = (await tx.query("SELECT * FROM courier_firms WHERE id = $1 FOR UPDATE", [k.firm_id])).rows[0];
    const endsAt = new Date(k.ends_at);
    const week = londonWeekKey(endsAt);
    const before = Number(
      (await tx.query("SELECT COALESCE(SUM(taxable_pence), 0) AS s FROM courier_contracts WHERE firm_id = $1 AND week_key = $2 AND status = 'completed'", [k.firm_id, week])).rows[0].s,
    );
    const pay = Number(k.pay_pence);
    const driver = Number(k.driver_pence);
    const taxable = Math.max(0, pay - driver - Number(k.fuel_pence));
    const tax = businessTax(before, taxable);
    const paid = pay - driver - tax;
    await tx.query("UPDATE courier_contracts SET week_key = $2, taxable_pence = $3, tax_pence = $4, paid_pence = $5 WHERE id = $1", [k.id, week, taxable, tax, paid]);
    await tx.query("UPDATE vehicles SET contract_id = NULL WHERE id = $1 AND contract_id = $2", [k.vehicle_id, k.id]);
    const title = listingTitle({ pickup: k.pickup, dropoff: k.dropoff });
    await moveMoney(tx, c, paid, "business", `${firm.name}: ${TIERS[k.tier as ContractTier]?.name ?? "Contract"} ${title} (fee ${fmtMoney(pay)}, driver ${fmtMoney(driver)}, tax ${fmtMoney(tax)})`, {
      type: "courier_contract",
      id: k.id,
    });
    const xp = Number(firm.xp) + (TIERS[k.tier as ContractTier]?.xp ?? 1);
    const level = Math.max(Number(firm.level), firmLevelFor(xp));
    await tx.query("UPDATE courier_firms SET xp = $2, level = $3, contracts_done = contracts_done + 1 WHERE id = $1", [firm.id, xp, level]);
    await emit(tx, c.id, "courier_delivered", { tier: String(k.tier) }, now);
    notices.push(`${firm.name} delivered ${k.goods} (${title}): ${fmtMoney(paid)} paid to you after the driver's wage${tax ? ` and ${fmtMoney(tax)} business tax` : ""}.`);
    if (level > Number(firm.level)) notices.push(`${firm.name} reached level ${level}: better contracts are on the board.`);
  }

  const starting = (await tx.query("SELECT * FROM ad_bookings WHERE character_id = $1 AND status = 'booked' AND NOT start_checked AND week_start <= $2 ORDER BY week_start, id", [c.id, now])).rows;
  for (const b of starting) {
    const reason = siteDown(String(b.site_id), String(b.week_key));
    if (!reason) {
      await tx.query("UPDATE ad_bookings SET start_checked = true WHERE id = $1", [b.id]);
      continue;
    }
    const res = await tx.query("UPDATE ad_bookings SET status = 'refunded', refund_reason = $2, start_checked = true, ended_at = $3 WHERE id = $1 AND status = 'booked' RETURNING id", [b.id, reason, now]);
    if (!res.rowCount) continue;
    const name = adSite(String(b.site_id))?.name ?? "the site";
    await moveMoney(tx, c, Number(b.price_pence), "advertising", `Refund: ad on ${name} couldn't be shown`, { type: "ad_booking", id: b.id });
    notices.push(`Your ad on ${name} couldn't be shown: ${reason.replace(/\.$/, "")}. You've been refunded ${fmtMoney(Number(b.price_pence))}.`);
  }
  return notices;
}

// ───────────────────────────── courier commands ─────────────────────────────

export async function registerFirm(tx: Tx, accountId: string, p: { first: string; second: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const name = firmName(p.first, p.second);
  if (!name) throw new GameError("bad_name", "Pick both parts of your firm's name from the lists.");
  if (await firmOf(tx, c.id)) throw new GameError("has_firm", "You already run a courier firm. One per person.");
  if (!(await carsOf(tx, c.id)).length) throw new GameError("needs_car", "You need a car to register a courier firm. Buy one in the Vehicles app.");
  const ins = await tx.query("INSERT INTO courier_firms (character_id, name, founded_at) VALUES ($1,$2,$3) ON CONFLICT (character_id) DO NOTHING RETURNING id", [c.id, name, now]);
  if (!ins.rowCount) throw new GameError("has_firm", "You already run a courier firm. One per person.");
  await moveMoney(tx, c, -FIRM.registrationPence, "business", `Registered ${name} (licence and branding)`, { type: "courier_firm", id: ins.rows[0].id });
  await emit(tx, c.id, "firm_registered", {}, now);
  return { message: `${name} is registered! Pick a contract from today's board and send a car out.` };
}

export async function startContract(tx: Tx, accountId: string, p: { slot: number; vehicleId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const firm = await firmOf(tx, c.id, true);
  if (!firm) throw new GameError("no_firm", "Register a courier firm first.");
  const day = londonDayKey(now);
  const listing = boardFor(day).find((l) => l.slot === Number(p.slot));
  if (!listing) throw new GameError("bad_listing", "That contract isn't on today's board.");
  const tier = TIERS[listing.tier];
  if (Number(firm.level) < tier.minLevel) throw new GameError("locked", `${tier.name} contracts unlock at firm level ${tier.minLevel}.`);
  const taken = await tx.query("SELECT 1 FROM courier_contracts WHERE firm_id = $1 AND day_key = $2 AND slot = $3", [firm.id, day, listing.slot]);
  if (taken.rowCount) throw new GameError("already_taken", "Your firm has already taken that contract today.");
  const v = (await tx.query("SELECT * FROM vehicles WHERE id::text = $1 AND character_id = $2 AND status = 'owned' FOR UPDATE", [String(p.vehicleId ?? ""), c.id])).rows[0];
  if (!v) throw new GameError("not_owned", "You don't own that vehicle.");
  const def = vehicleDef(String(v.def_id))!;
  if (def.mode !== "drive") throw new GameError("not_a_car", "Only cars can run courier contracts.");
  const blocker = carBlocker(v, now);
  if (blocker) throw new GameError("car_busy", blocker);
  if (cargoOf(def.id) < tier.cargo) throw new GameError("too_small", `${tier.name} needs more boot space: use a family car or an electric saloon.`);
  const limit = dailyContractLimit(deliveredCars(await carsOf(tx, c.id), now), Number(firm.level));
  if ((await startedOn(tx, firm.id, day)) >= limit) throw new GameError("daily_limit", `Your firm can take ${limit} contract${limit === 1 ? "" : "s"} a day with its cars. More cars or a higher firm level raise the limit.`);
  const deadline = londonInstant(day, listing.deadlineHour);
  const endsAt = new Date(now.getTime() + durationMs(listing.minutes));
  if (endsAt > deadline) throw new GameError("too_late", `Too late: this one must be delivered by ${londonClock(deadline)} and takes ${listing.minutes} minutes.`);
  const fuel = contractFuel(def.tripPence, listing.minutes);
  const wear = contractWear(def.wearPerTrip, listing.minutes, listing.tier);
  const id = crypto.randomUUID();
  const title = listingTitle(listing);
  await moveMoney(tx, c, -fuel, "business", `${firm.name}: fuel for ${title}`, { type: "courier_contract", id });
  await tx.query(
    `INSERT INTO courier_contracts (id, firm_id, character_id, vehicle_id, day_key, slot, tier, pickup, dropoff, goods, pay_pence, driver_pence, fuel_pence, wear, started_at, ends_at, deadline_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, firm.id, c.id, v.id, day, listing.slot, listing.tier, listing.pickup, listing.dropoff, listing.goods, listing.payPence, listing.driverPence, fuel, wear, now, endsAt, deadline],
  );
  await tx.query("UPDATE vehicles SET contract_id = $2, condition = GREATEST(0, condition - $3) WHERE id = $1", [v.id, id, wear]);
  await emit(tx, c.id, "courier_started", { tier: listing.tier }, now);
  return { message: `Your ${def.name.toLowerCase()} is on its way with ${listing.goods} (${title}). Back at ${londonClock(endsAt)}; the ${fmtMoney(listing.payPence)} fee is paid on delivery.` };
}

export async function abandonContract(tx: Tx, accountId: string, p: { contractId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const k = (await tx.query("SELECT * FROM courier_contracts WHERE id::text = $1 AND character_id = $2 FOR UPDATE", [String(p.contractId ?? ""), c.id])).rows[0];
  if (!k) throw new GameError("no_contract", "That contract isn't one of yours.");
  if (k.status !== "running") throw new GameError("finished", "That contract has already finished.");
  await tx.query("UPDATE courier_contracts SET status = 'abandoned', settled_at = $2 WHERE id = $1", [k.id, now]);
  await tx.query("UPDATE vehicles SET contract_id = NULL WHERE id = $1 AND contract_id = $2", [k.vehicle_id, k.id]);
  return { message: "You called the car back. The fee isn't paid, fuel isn't refunded and the run still counts towards today's limit." };
}

// ───────────────────────────── advertising commands ─────────────────────────────

const isTemplate = (x: unknown) => AD_TEMPLATES.some((t) => t.id === x);
const isColour = (x: unknown) => AD_COLOURS.some((t) => t.id === x);
const isSlogan = (x: unknown) => AD_SLOGANS.some((t) => t.id === x);

export async function bookAd(
  tx: Tx,
  accountId: string,
  p: { siteId: string; week: "this" | "next"; template: string; colour: string; slogan: string; brand: AdBrand },
  now: Date,
) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const site = adSite(String(p.siteId));
  if (!site) throw new GameError("bad_site", "Unknown advertising site.");
  if (!isTemplate(p.template) || !isColour(p.colour) || !isSlogan(p.slogan)) throw new GameError("bad_design", "Choose a template, a colour and a slogan from the lists.");
  if (p.week !== "this" && p.week !== "next") throw new GameError("bad_week", "Choose this week or next week.");
  let brandText: string;
  if (p.brand === "name") brandText = c.name;
  else if (p.brand === "firm") {
    const firm = await firmOf(tx, c.id);
    if (!firm) throw new GameError("no_firm", "Register a courier firm to advertise it, or advertise under your own name.");
    brandText = String(firm.name);
  } else throw new GameError("bad_brand", "Choose whose ad it is.");

  const current = adWeek(now);
  const week = p.week === "next" ? adWeek(current.end) : current;
  let price = site.pricePence;
  if (p.week === "this") {
    const down = siteDown(site.id, week.key);
    if (down) throw new GameError("site_down", `${site.name} can't show ads this week. ${down}`);
    price = adPrice(site, week.end.getTime() - now.getTime());
  }
  const mine = (await tx.query("SELECT site_id FROM ad_bookings WHERE character_id = $1 AND week_key = $2 AND status = 'booked'", [c.id, week.key])).rows;
  if (mine.some((r) => r.site_id === site.id)) throw new GameError("already_booked", `You already have an ad on ${site.name} that week.`);
  if (mine.length >= AD_RULES.maxPerWeek) throw new GameError("weekly_limit", `You can have up to ${AD_RULES.maxPerWeek} ads in one week.`);

  // Lock this site's week so the slot count can't be oversold by simultaneous bookings.
  await tx.query("INSERT INTO ad_site_weeks (site_id, week_key) VALUES ($1, $2) ON CONFLICT DO NOTHING", [site.id, week.key]);
  await tx.query("SELECT 1 FROM ad_site_weeks WHERE site_id = $1 AND week_key = $2 FOR UPDATE", [site.id, week.key]);
  const taken = new Set((await tx.query("SELECT slot FROM ad_bookings WHERE site_id = $1 AND week_key = $2 AND status = 'booked'", [site.id, week.key])).rows.map((r) => Number(r.slot)));
  let slot = -1;
  for (let i = 0; i < site.slots; i++) {
    if (!taken.has(i)) {
      slot = i;
      break;
    }
  }
  if (slot < 0) throw new GameError("sold_out", `All ${site.slots} slots on ${site.name} are sold for that week.`);

  const id = crypto.randomUUID();
  await moveMoney(tx, c, -price, "advertising", `Ad on ${site.name}, week ${week.key}`, { type: "ad_booking", id });
  await tx.query(
    `INSERT INTO ad_bookings (id, character_id, site_id, week_key, slot, week_start, week_end, template, colour, slogan, brand, brand_text, price_pence, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, c.id, site.id, week.key, slot, week.start, week.end, p.template, p.colour, p.slogan, p.brand, brandText, price, now],
  );
  await emit(tx, c.id, "ad_booked", { site: site.id }, now);
  return {
    message:
      p.week === "this"
        ? `Your ad is up on ${site.name} now, until Monday 00:00. Paid ${fmtMoney(price)} for the rest of the week.`
        : `Booked: your ad goes up on ${site.name} on Monday at 00:00 for the week (${fmtMoney(price)}). If the site can't show it, you're refunded in full.`,
  };
}

export async function cancelAd(tx: Tx, accountId: string, p: { bookingId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const b = (await tx.query("SELECT * FROM ad_bookings WHERE id::text = $1 AND character_id = $2 FOR UPDATE", [String(p.bookingId ?? ""), c.id])).rows[0];
  if (!b) throw new GameError("no_booking", "That booking isn't one of yours.");
  if (b.status !== "booked") throw new GameError("ended", "That booking has already ended.");
  if (new Date(b.week_start) <= now) throw new GameError("already_showing", "Your ad is already on show, so it can't be refunded. Refunds only apply to ads that couldn't be shown.");
  await tx.query("UPDATE ad_bookings SET status = 'cancelled', refund_reason = 'Cancelled before it went up', ended_at = $2 WHERE id = $1", [b.id, now]);
  const name = adSite(String(b.site_id))?.name ?? "the site";
  await moveMoney(tx, c, Number(b.price_pence), "advertising", `Refund: cancelled ad on ${name} before it went up`, { type: "ad_booking", id: b.id });
  return { message: `Cancelled before it went up: ${fmtMoney(Number(b.price_pence))} refunded.` };
}

// ───────────────────────────── view ─────────────────────────────

/** Ads on show this week, by site: public preset content and the brand line only, never who booked them. */
async function liveAds(tx: Tx, now: Date) {
  const week = adWeek(now);
  const rows = (await tx.query("SELECT * FROM ad_bookings WHERE week_key = $1 AND status = 'booked' AND week_start <= $2 ORDER BY site_id, slot", [week.key, now])).rows;
  const live: Record<string, { id: string; template: string; colour: string; slogan: string; brand: string }[]> = {};
  for (const s of AD_SITES) live[s.id] = [];
  for (const r of rows) {
    if (!live[r.site_id] || siteDown(String(r.site_id), week.key)) continue;
    live[r.site_id].push({ id: String(r.id), template: String(r.template), colour: colourHex(String(r.colour)), slogan: sloganText(String(r.slogan)), brand: String(r.brand_text) });
  }
  return live;
}

export async function fleetsView(tx: Tx, c: CharRow, now: Date) {
  // ── courier ──
  const firm = await firmOf(tx, c.id);
  const cars = await carsOf(tx, c.id);
  const day = londonDayKey(now);
  const level = firm ? Number(firm.level) : 1;
  const todays = firm ? (await tx.query("SELECT * FROM courier_contracts WHERE firm_id = $1 AND day_key = $2", [firm.id, day])).rows : [];
  const limit = dailyContractLimit(deliveredCars(cars, now), level);
  const listings = boardFor(day).map((l) => {
    const t = TIERS[l.tier];
    const deadlineAt = londonInstant(day, l.deadlineHour);
    const mine = todays.find((k) => Number(k.slot) === l.slot);
    let reason: string | null = null;
    if (mine) reason = mine.status === "running" ? "On its way." : mine.status === "completed" ? "Delivered." : "Called back.";
    else if (level < t.minLevel) reason = `Unlocks at firm level ${t.minLevel}.`;
    else if (now.getTime() + durationMs(l.minutes) > deadlineAt.getTime()) reason = `Too late to deliver by ${londonClock(deadlineAt)}.`;
    return {
      ...l,
      title: listingTitle(l),
      pickupName: venue(l.pickup)?.name ?? l.pickup,
      dropoffName: venue(l.dropoff)?.name ?? l.dropoff,
      tierName: t.name,
      minLevel: t.minLevel,
      cargo: t.cargo,
      extraWear: t.extraWear,
      deadlineAt: deadlineAt.toISOString(),
      status: mine ? String(mine.status) : null,
      open: !reason,
      reason,
    };
  });
  const contractRows = firm ? (await tx.query("SELECT * FROM courier_contracts WHERE firm_id = $1 ORDER BY started_at DESC LIMIT 12", [firm.id])).rows : [];
  const contractView = (k: Row) => ({
    id: String(k.id),
    title: listingTitle({ pickup: k.pickup, dropoff: k.dropoff }),
    tierName: TIERS[k.tier as ContractTier]?.name ?? String(k.tier),
    goods: String(k.goods),
    vehicleName: vehicleDef(String(cars.find((v) => v.id === k.vehicle_id)?.def_id ?? ""))?.name ?? "Car",
    status: String(k.status),
    startedAt: new Date(k.started_at).toISOString(),
    endsAt: new Date(k.ends_at).toISOString(),
    payPence: Number(k.pay_pence),
    driverPence: Number(k.driver_pence),
    fuelPence: Number(k.fuel_pence),
    taxPence: Number(k.tax_pence),
    paidPence: Number(k.paid_pence),
  });
  const thisWeek = londonWeekKey(now);
  const totals = firm
    ? (await tx.query("SELECT COALESCE(SUM(paid_pence),0) AS paid, COALESCE(SUM(tax_pence),0) AS tax, COALESCE(SUM(fuel_pence),0) AS fuel, COALESCE(SUM(driver_pence),0) AS driver, count(*) AS n FROM courier_contracts WHERE firm_id = $1 AND week_key = $2 AND status = 'completed'", [firm.id, thisWeek])).rows[0]
    : null;

  // ── advertising ──
  const week = adWeek(now);
  const next = adWeek(week.end);
  const counts = (await tx.query("SELECT site_id, week_key, count(*) AS n FROM ad_bookings WHERE week_key = ANY($1) AND status = 'booked' GROUP BY site_id, week_key", [[week.key, next.key]])).rows;
  const used = (site: string, key: string) => Number(counts.find((r) => r.site_id === site && r.week_key === key)?.n ?? 0);
  const mineRows = (await tx.query("SELECT * FROM ad_bookings WHERE character_id = $1 ORDER BY week_start DESC, created_at DESC LIMIT 12", [c.id])).rows;

  return {
    courier: {
      registrationPence: FIRM.registrationPence,
      nameFirst: FIRM_NAME_FIRST,
      nameSecond: FIRM_NAME_SECOND,
      tiers: (Object.keys(TIERS) as ContractTier[]).map((id) => ({ id, name: TIERS[id].name, minLevel: TIERS[id].minLevel, cargo: TIERS[id].cargo })),
      contractsPerCar: FIRM.contractsPerCar,
      maxCarsCounted: FIRM.maxCarsCounted,
      hasCar: cars.length > 0,
      cars: cars.map((v) => {
        const def = vehicleDef(String(v.def_id))!;
        const reason = carBlocker(v, now);
        return { id: String(v.id), defId: def.id, name: def.name, colour: String(v.colour), condition: Number(v.condition), cargo: cargoOf(def.id), tripPence: def.tripPence, wearPerTrip: def.wearPerTrip, available: !reason, reason };
      }),
      firm: firm
        ? {
            id: String(firm.id),
            name: String(firm.name),
            level,
            maxLevel: FIRM_MAX_LEVEL,
            xp: Number(firm.xp),
            levelFrom: FIRM_LEVELS[level - 1],
            levelTo: FIRM_LEVELS[level] ?? null,
            contractsDone: Number(firm.contracts_done),
            limit,
            usedToday: todays.length,
            week: { paidPence: Number(totals.paid), taxPence: Number(totals.tax), fuelPence: Number(totals.fuel), driverPence: Number(totals.driver), runs: Number(totals.n) },
          }
        : null,
      board: { day, listings },
      running: contractRows.filter((k) => k.status === "running").map(contractView),
      recent: contractRows.filter((k) => k.status !== "running").slice(0, 8).map(contractView),
    },
    ads: {
      week: { key: week.key, start: week.start.toISOString(), end: week.end.toISOString() },
      next: { key: next.key, start: next.start.toISOString(), end: next.end.toISOString() },
      sites: AD_SITES.map((s) => ({
        ...s,
        whereName: s.where === "street" ? "The street (on every journey)" : venue(s.where)?.name ?? s.where,
        thisWeek: { pricePence: adPrice(s, week.end.getTime() - now.getTime()), left: s.slots - used(s.id, week.key), down: siteDown(s.id, week.key) },
        nextWeek: { pricePence: s.pricePence, left: s.slots - used(s.id, next.key) },
      })),
      templates: AD_TEMPLATES,
      colours: AD_COLOURS,
      slogans: AD_SLOGANS,
      maxPerWeek: AD_RULES.maxPerWeek,
      brands: { name: c.name, firm: firm ? String(firm.name) : null },
      mine: mineRows.map((b) => {
        const start = new Date(b.week_start);
        const end = new Date(b.week_end);
        const status = b.status !== "booked" ? String(b.status) : start > now ? "scheduled" : end > now ? "live" : "expired";
        return {
          id: String(b.id),
          siteId: String(b.site_id),
          siteName: adSite(String(b.site_id))?.name ?? String(b.site_id),
          weekKey: String(b.week_key),
          start: start.toISOString(),
          end: end.toISOString(),
          template: String(b.template),
          colour: colourHex(String(b.colour)),
          slogan: sloganText(String(b.slogan)),
          brand: String(b.brand_text),
          pricePence: Number(b.price_pence),
          status,
          refundReason: b.refund_reason ? String(b.refund_reason) : null,
          cancellable: status === "scheduled",
        };
      }),
      live: await liveAds(tx, now),
    },
  };
}
