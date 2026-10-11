import crypto from "node:crypto";
import {
  HARDSHIP,
  HAZARDS,
  PET_CARE,
  PET_FOOD_ID,
  PET_KINDS,
  PET_RULES,
  POLICIES,
  PRESTIGE_FURNITURE,
  VEHICLES,
  VEHICLE_RULES,
  forecastFor,
  hazardFor,
  petWellbeing,
  premiumFor,
  serviceCost,
  uninsuredShare,
  vehicleDef,
  vehicleResale,
  type HazardKind,
  type HazardRoll,
  type PetCare,
  type PetKind,
  type PolicyKind,
  type VehicleMode,
} from "@/content/lateGame";
import { venue, type TravelMode } from "@/content/world";
import { applyEffects } from "@/sim/needs";
import { londonWeekKey } from "@/sim/shift";
import { durationMs, londonClock, nextLondonWeekly } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { changeItems, emit, fmtMoney, loadCtx, moveMoney, requireCharacter, saveNeeds, settle, type CharRow } from "./game";

/** Late-game charges fall due with rent: Saturday 09:00 London. */
const WEEKLY = { isoWeekday: 6, hour: 9 };
const DAY_MS = 86_400_000;

// ───────────────────────────── time ─────────────────────────────

/** The insurance week containing `at`: from a Saturday 09:00 (inclusive) to the next. Keyed like rent bills. */
export function insuranceWeek(at: Date) {
  let start = nextLondonWeekly(new Date(at.getTime() - 8 * DAY_MS), WEEKLY.isoWeekday, WEEKLY.hour);
  for (let guard = 0; guard < 3; guard++) {
    const next = nextLondonWeekly(start, WEEKLY.isoWeekday, WEEKLY.hour);
    if (next.getTime() > at.getTime()) break;
    start = next;
  }
  return { start, end: nextLondonWeekly(start, WEEKLY.isoWeekday, WEEKLY.hour), key: londonWeekKey(start) };
}

async function lateState(tx: Tx, c: CharRow, now: Date) {
  await tx.query("INSERT INTO late_game_state (character_id, bills_due_at, hazards_checked_until) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [
    c.id,
    nextLondonWeekly(now, WEEKLY.isoWeekday, WEEKLY.hour),
    now,
  ]);
  return (await tx.query("SELECT * FROM late_game_state WHERE character_id = $1 FOR UPDATE", [c.id])).rows[0];
}

// ───────────────────────────── settlement ─────────────────────────────

/**
 * Runs at the end of every settlement: parks vehicles after their journeys, charges weekly premiums and
 * upkeep once per week, records at most one seeded incident per week, and settles pet wellbeing.
 */
export async function settleLateGame(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  await parkVehicles(tx, c);
  const st = await lateState(tx, c, now);

  let due = new Date(st.bills_due_at);
  // After a long absence only the last twelve weeks are charged (an offline cap, like needs).
  if (due.getTime() < now.getTime() - 84 * DAY_MS) due = nextLondonWeekly(new Date(now.getTime() - 84 * DAY_MS), WEEKLY.isoWeekday, WEEKLY.hour);
  for (let guard = 0; due <= now && guard < 14; guard++) {
    notices.push(...(await chargeWeek(tx, c, due, now)));
    due = nextLondonWeekly(due, WEEKLY.isoWeekday, WEEKLY.hour);
  }
  if (due.getTime() !== new Date(st.bills_due_at).getTime()) await tx.query("UPDATE late_game_state SET bills_due_at = $2 WHERE character_id = $1", [c.id, due]);

  const checked = new Date(st.hazards_checked_until);
  if (now > checked) {
    // Catch up at most five weeks; the roll for each week is fixed by its seed, so order doesn't matter.
    let week = insuranceWeek(new Date(Math.max(checked.getTime(), now.getTime() - 35 * DAY_MS)));
    for (let guard = 0; guard < 6; guard++) {
      const roll = hazardFor(c.id, week.key, week.start);
      const newcomerUntil = c.created_at.getTime() + HARDSHIP.newcomerDays * DAY_MS;
      if (roll && roll.at > checked && roll.at <= now && roll.at.getTime() >= newcomerUntil && (await exposedAt(tx, c, roll.at))) {
        const n = await recordHazard(tx, c, roll, week.key, now);
        if (n) notices.push(n);
      }
      if (week.end > now) break;
      week = insuranceWeek(week.end);
    }
    await tx.query("UPDATE late_game_state SET hazards_checked_until = $2 WHERE character_id = $1", [c.id, now]);
  }

  notices.push(...(await settlePets(tx, c, now)));
  return notices;
}

/** A vehicle used for a journey is parked at the destination on arrival, or back at the origin if you turned back. */
async function parkVehicles(tx: Tx, c: CharRow) {
  const rows = (
    await tx.query(
      `SELECT v.id, v.journey_origin, j.status, j.destination FROM vehicles v LEFT JOIN journeys j ON j.id = v.journey_id
       WHERE v.character_id = $1 AND v.journey_id IS NOT NULL`,
      [c.id],
    )
  ).rows;
  for (const r of rows) {
    if (r.status === "in_transit") continue;
    const where = r.status === "arrived" ? r.destination : r.journey_origin;
    await tx.query("UPDATE vehicles SET location = COALESCE($2, location), journey_id = NULL, journey_origin = NULL WHERE id = $1", [r.id, where]);
  }
}

async function chargeWeek(tx: Tx, c: CharRow, due: Date, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const week = londonWeekKey(due);

  // Insurance premiums, priced from the coming week's forecast. An unaffordable premium lapses the policy.
  const policies = (await tx.query("SELECT * FROM insurance_policies WHERE character_id = $1 AND renews AND started_at < $2 ORDER BY kind", [c.id, due])).rows;
  for (const p of policies) {
    const kind = p.kind as PolicyKind;
    const billKind = `insurance_${kind}`;
    const exists = await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND kind = $2 AND period_key = $3", [c.id, billKind, week]);
    if (exists.rowCount) continue;
    const premium = premiumFor(kind, week);
    if (c.cash_pence >= premium) {
      await moveMoney(tx, c, -premium, "insurance", `${POLICIES[kind].name} for week ${week}`, { type: "policy", id: p.id });
      await tx.query("INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at, paid_at) VALUES ($1,$2,$3,$4,$5,'paid',$6,$7)", [
        c.id,
        billKind,
        week,
        `Insurance · ${POLICIES[kind].name} (${forecastFor(week).name.toLowerCase()})`,
        premium,
        due,
        now,
      ]);
    } else {
      await tx.query("UPDATE insurance_policies SET renews = false, ended_at = $2, end_reason = 'lapsed' WHERE id = $1", [p.id, due]);
      notices.push(`Your ${POLICIES[kind].name.toLowerCase()} lapsed: the ${fmtMoney(premium)} premium couldn't be paid.`);
    }
  }

  // Vehicle upkeep for everything owned when the week began. What can't be paid keeps that vehicle off the road.
  const exists = await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND kind = 'vehicle_upkeep' AND period_key = $2", [c.id, week]);
  if (!exists.rowCount) {
    const vehicles = (
      await tx.query(
        `SELECT * FROM vehicles WHERE character_id = $1 AND bought_at < $2 AND owed_pence = 0 AND (status = 'owned' OR ended_at > $2)
         ORDER BY bought_at, id FOR UPDATE`,
        [c.id, due],
      )
    ).rows;
    let total = 0;
    let count = 0;
    for (const v of vehicles) {
      const up = vehicleDef(v.def_id)?.upkeepPence ?? 0;
      if (c.cash_pence - total >= up) {
        total += up;
        count++;
      } else if (v.status === "owned") {
        await tx.query("UPDATE vehicles SET owed_pence = $2 WHERE id = $1", [v.id, up]);
        notices.push(`Your ${vehicleDef(v.def_id)?.name.toLowerCase()} is off the road until its ${fmtMoney(up)} upkeep is paid (Vehicles app).`);
      }
    }
    if (total > 0) {
      await moveMoney(tx, c, -total, "vehicles", `Vehicle upkeep for week ${week}`, { type: "bill", id: week });
      await tx.query("INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at, paid_at) VALUES ($1,'vehicle_upkeep',$2,$3,$4,'paid',$5,$6)", [
        c.id,
        week,
        `Vehicle upkeep · ${count} vehicle${count > 1 ? "s" : ""}`,
        total,
        due,
        now,
      ]);
    }
  }
  return notices;
}

/**
 * Incidents are a late-game risk: they only happen once you own something worth protecting (a vehicle or a
 * prestige item). Everyday early life stays risk-free, so a newcomer is never set back by bad luck.
 */
async function exposedAt(tx: Tx, c: CharRow, at: Date) {
  const v = await tx.query("SELECT 1 FROM vehicles WHERE character_id = $1 AND bought_at < $2 AND (status = 'owned' OR ended_at > $2) LIMIT 1", [c.id, at]);
  if (v.rowCount) return true;
  const f = await tx.query("SELECT 1 FROM furniture WHERE character_id = $1 AND def_id = ANY($2) LIMIT 1", [c.id, PRESTIGE_FURNITURE.map((x) => x.id)]);
  return f.rowCount! > 0;
}

/** Was a policy of this kind in force at `at`, with that week's premium paid? Never retroactive. */
async function coveredAt(tx: Tx, c: CharRow, kind: PolicyKind, at: Date, weekKey: string) {
  const res = await tx.query(
    `SELECT 1 FROM insurance_policies p WHERE p.character_id = $1 AND p.kind = $2 AND p.started_at < $3 AND (p.ended_at IS NULL OR p.ended_at > $3)
       AND EXISTS (SELECT 1 FROM bills b WHERE b.character_id = $1 AND b.kind = $4 AND b.period_key = $5 AND b.status = 'paid')
     LIMIT 1`,
    [c.id, kind, at, `insurance_${kind}`, weekKey],
  );
  return res.rowCount! > 0;
}

/** Shift wages in the seven days before an incident: below the threshold, hardship relief applies. */
async function lowIncomeAt(tx: Tx, c: CharRow, at: Date) {
  const res = await tx.query("SELECT COALESCE(SUM(net_pence), 0) AS s FROM shifts WHERE character_id = $1 AND settled_at > $2 AND settled_at <= $3", [
    c.id,
    new Date(at.getTime() - 7 * DAY_MS),
    at,
  ]);
  return Number(res.rows[0].s) < HARDSHIP.lowIncomePence;
}

async function recordHazard(tx: Tx, c: CharRow, roll: HazardRoll, weekKey: string, now: Date): Promise<string | null> {
  const h = HAZARDS[roll.kind];
  let vehicle: Record<string, unknown> | null = null;
  if (roll.kind === "bike_stolen") {
    const cycles = VEHICLES.filter((v) => v.mode === "cycle").map((v) => v.id);
    vehicle =
      (
        await tx.query(
          `SELECT * FROM vehicles WHERE character_id = $1 AND status = 'owned' AND def_id = ANY($2) AND journey_id IS NULL AND bought_at < $3 AND delivered_at <= $3
           ORDER BY price_pence DESC, id LIMIT 1 FOR UPDATE`,
          [c.id, cycles, roll.at],
        )
      ).rows[0] ?? null;
    // Nothing to steal: a lucky week.
    if (!vehicle) return null;
  }
  const insured = await coveredAt(tx, c, h.policy, roll.at, weekKey);
  const excess = POLICIES[h.policy].excessPence;
  const itemValue = vehicle ? vehicleResale(Number(vehicle.price_pence), Number(vehicle.condition)) : 0;
  const assessed = vehicle ? itemValue : roll.lossPence;
  const owedShare = vehicle ? 0 : insured ? roll.lossPence : uninsuredShare(roll.lossPence, await lowIncomeAt(tx, c, roll.at));
  // Nobody is pushed below zero: whatever can't be afforded is forgiven.
  const charged = Math.min(owedShare, c.cash_pence);
  const relief = vehicle || insured ? 0 : roll.lossPence - charged;
  const payout = insured ? Math.max(0, charged + itemValue - excess) : 0;
  const id = crypto.randomUUID();
  const ins = await tx.query(
    `INSERT INTO hazard_events (id, character_id, week_key, kind, occurred_at, affected, vehicle_id, assessed_loss_pence, charged_pence, item_value_pence,
       hardship_relief_pence, insured, policy_kind, excess_pence, payout_pence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING`,
    [id, c.id, weekKey, roll.kind, roll.at, vehicle ? String(vehicle.def_id) : roll.kind === "burst_pipe" ? "home" : "phone", vehicle?.id ?? null, assessed, charged, itemValue, relief, insured, h.policy, insured ? excess : 0, payout],
  );
  if (!ins.rowCount) return null;
  if (vehicle) await tx.query("UPDATE vehicles SET status = 'stolen', ended_at = $2 WHERE id = $1", [vehicle.id, roll.at]);
  if (charged) await moveMoney(tx, c, -charged, "hazard", `${h.name}: ${roll.kind === "burst_pipe" ? "repairs" : "replacement"}`, { type: "hazard", id });
  await emit(tx, c.id, "hazard", { kind: roll.kind }, now);
  const when = londonClock(roll.at);
  const what = vehicle ? `${h.name} (${vehicleDef(String(vehicle.def_id))?.name.toLowerCase()}, worth ${fmtMoney(itemValue)})` : `${h.name}: it cost ${fmtMoney(charged)}`;
  if (insured) return `${what} at ${when}. You were covered: claim ${fmtMoney(payout)} in the Insurance app.`;
  return `${what} at ${when}. You weren't insured${relief > 0 ? `; ${fmtMoney(relief)} of the loss was waived (capped loss and hardship relief)` : ""}.`;
}

async function settlePets(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const pets = (await tx.query("SELECT * FROM pets WHERE character_id = $1 AND rehomed_at IS NULL ORDER BY adopted_at, id", [c.id])).rows;
  for (const p of pets) {
    const w = petWellbeing(Number(p.wellbeing), new Date(p.settled_at), now, p.kind as PetKind);
    let prompted = !!p.prompted;
    if (w < PET_RULES.prompt && !prompted) {
      notices.push(`${p.name} could do with some attention. Feed, play with or groom them at home.`);
      prompted = true;
    } else if (w >= PET_RULES.prompt) prompted = false;
    await tx.query("UPDATE pets SET wellbeing = $2, settled_at = $3, prompted = $4 WHERE id = $1", [p.id, Math.round(w * 100) / 100, now, prompted]);
  }
  return notices;
}

// ───────────────────────────── journeys ─────────────────────────────

const VEHICLE_WORD: Record<VehicleMode, string> = { cycle: "a bicycle or scooter", drive: "a car" };

/** Which owned vehicles can make a journey from where the character is now. Used by StartJourney and travel quotes. */
export async function garageFor(tx: Tx, c: CharRow, now: Date) {
  const rows = (await tx.query("SELECT * FROM vehicles WHERE character_id = $1 AND status = 'owned' ORDER BY bought_at, id", [c.id])).rows;
  const why = (v: Record<string, unknown>): string | null => {
    const def = vehicleDef(String(v.def_id))!;
    if (new Date(v.delivered_at as Date) > now) return `Your ${def.name.toLowerCase()} is being delivered; it arrives at ${londonClock(new Date(v.delivered_at as Date))}.`;
    if (v.journey_id) return `Your ${def.name.toLowerCase()} is already on the move.`;
    if (Number(v.owed_pence) > 0) return `Your ${def.name.toLowerCase()} is off the road until its upkeep is paid.`;
    if (Number(v.condition) < VEHICLE_RULES.minCondition) return `Your ${def.name.toLowerCase()} needs a service first (condition ${v.condition}%).`;
    if (v.location !== c.location) return `Your ${def.name.toLowerCase()} is parked at ${venue(String(v.location))?.name ?? "another place"}.`;
    return null;
  };
  const best = (mode: TravelMode) =>
    rows
      .filter((v) => vehicleDef(v.def_id)?.mode === mode && !why(v))
      .sort((a, b) => vehicleDef(a.def_id)!.speed - vehicleDef(b.def_id)!.speed || vehicleDef(a.def_id)!.tripPence - vehicleDef(b.def_id)!.tripPence)[0];
  const vehicle = (mode: TravelMode) => {
    const v = best(mode);
    if (!v) return undefined;
    const def = vehicleDef(v.def_id)!;
    return { id: String(v.id), speed: def.speed, tripPence: def.tripPence, wear: def.wearPerTrip, name: mode === "cycle" ? (def.id === "e_scooter" ? "Scooter" : "Cycle") : "Drive" };
  };
  return {
    owned: { cycle: !!best("cycle"), drive: !!best("drive") },
    vehicle,
    /** Why an owned-vehicle mode isn't on offer here, or null for other modes. */
    blocker(mode: TravelMode): string | null {
      if (mode !== "cycle" && mode !== "drive") return null;
      const mine = rows.filter((v) => vehicleDef(v.def_id)?.mode === mode);
      if (!mine.length) return `You don't own ${VEHICLE_WORD[mode]}. Buy one in the Vehicles app.`;
      return mine.map(why).find(Boolean) ?? null;
    },
    /** Takes the vehicle on the journey: it wears a little and moves with you. */
    async use(t: Tx, mode: TravelMode, journeyId: string, origin: string) {
      const v = vehicle(mode);
      if (!v) return;
      await t.query("UPDATE vehicles SET journey_id = $2, journey_origin = $3, condition = GREATEST(0, condition - $4), trips = trips + 1 WHERE id = $1 AND journey_id IS NULL", [
        v.id,
        journeyId,
        origin,
        v.wear,
      ]);
    },
  };
}

// ───────────────────────────── vehicle commands ─────────────────────────────

async function ownedVehicle(tx: Tx, c: CharRow, vehicleId: unknown) {
  const res = await tx.query("SELECT * FROM vehicles WHERE id::text = $1 AND character_id = $2 AND status = 'owned' FOR UPDATE", [String(vehicleId ?? ""), c.id]);
  if (!res.rowCount) throw new GameError("not_owned", "You don't own that vehicle — it may already have been sold.");
  return res.rows[0];
}

export async function buyVehicle(tx: Tx, accountId: string, p: { defId: string; colour?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = vehicleDef(p.defId);
  if (!def) throw new GameError("bad_vehicle", "Unknown vehicle.");
  const count = Number((await tx.query("SELECT count(*) AS n FROM vehicles WHERE character_id = $1 AND status = 'owned'", [c.id])).rows[0].n);
  if (count >= VEHICLE_RULES.maxOwned) throw new GameError("garage_full", `You can own up to ${VEHICLE_RULES.maxOwned} vehicles. Sell one first.`);
  const colour = p.colour && def.colours.includes(p.colour) ? p.colour : def.colours[0];
  const id = crypto.randomUUID();
  const arrives = new Date(now.getTime() + durationMs(VEHICLE_RULES.deliveryMinutes));
  await moveMoney(tx, c, -def.pricePence, "vehicles", `Bought a ${def.name.toLowerCase()}`, { type: "vehicle", id });
  await tx.query("INSERT INTO vehicles (id, character_id, def_id, colour, price_pence, location, bought_at, delivered_at) VALUES ($1,$2,$3,$4,$5,'home',$6,$7)", [
    id,
    c.id,
    def.id,
    colour,
    def.pricePence,
    now,
    arrives,
  ]);
  await emit(tx, c.id, "vehicle_bought", { def: def.id }, now);
  return { message: `Your ${def.name.toLowerCase()} will be delivered to your home at ${londonClock(arrives)}. Upkeep is ${fmtMoney(def.upkeepPence)} a week, charged with rent.` };
}

export async function sellVehicle(tx: Tx, accountId: string, p: { vehicleId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const v = await ownedVehicle(tx, c, p.vehicleId);
  if (v.journey_id) throw new GameError("in_use", "You can't sell it mid-journey.");
  const def = vehicleDef(v.def_id)!;
  const value = vehicleResale(Number(v.price_pence), Number(v.condition));
  const owed = Number(v.owed_pence);
  const proceeds = Math.max(0, value - owed);
  await tx.query("UPDATE vehicles SET status = 'sold', ended_at = $2, owed_pence = 0 WHERE id = $1", [v.id, now]);
  await moveMoney(tx, c, proceeds, "vehicles", `Sold your ${def.name.toLowerCase()}${owed ? ` (less ${fmtMoney(Math.min(owed, value))} unpaid upkeep)` : ""}`, { type: "vehicle", id: v.id });
  return { message: `Sold your ${def.name.toLowerCase()} for ${fmtMoney(proceeds)}.` };
}

export async function serviceVehicle(tx: Tx, accountId: string, p: { vehicleId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const v = await ownedVehicle(tx, c, p.vehicleId);
  if (v.journey_id) throw new GameError("in_use", "Wait until you've arrived.");
  const def = vehicleDef(v.def_id)!;
  const cost = serviceCost(def, Number(v.condition));
  if (cost <= 0) throw new GameError("no_service", "It's in perfect condition already.");
  await moveMoney(tx, c, -cost, "vehicles", `Service: ${def.name.toLowerCase()} (${v.condition}% → 100%)`, { type: "vehicle", id: v.id });
  await tx.query("UPDATE vehicles SET condition = 100 WHERE id = $1", [v.id]);
  return { message: `A mobile mechanic serviced your ${def.name.toLowerCase()} for ${fmtMoney(cost)}. Good as new.` };
}

export async function payVehicleUpkeep(tx: Tx, accountId: string, p: { vehicleId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const v = await ownedVehicle(tx, c, p.vehicleId);
  const owed = Number(v.owed_pence);
  if (!owed) throw new GameError("nothing_owed", "Nothing is owed on this vehicle.");
  const def = vehicleDef(v.def_id)!;
  await moveMoney(tx, c, -owed, "vehicles", `Overdue upkeep: ${def.name.toLowerCase()}`, { type: "vehicle", id: v.id });
  await tx.query("UPDATE vehicles SET owed_pence = 0 WHERE id = $1", [v.id]);
  return { message: `Paid ${fmtMoney(owed)}. Your ${def.name.toLowerCase()} is back on the road.` };
}

// ───────────────────────────── insurance commands ─────────────────────────────

function policyKind(k: unknown): PolicyKind {
  if (k !== "home" && k !== "possessions") throw new GameError("bad_policy", "Unknown policy.");
  return k;
}

export async function buyInsurance(tx: Tx, accountId: string, p: { kind: PolicyKind }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  // Settling first records anything that already happened, so a new policy can never cover it.
  await settle(tx, c, now);
  const kind = policyKind(p.kind);
  const renewing = await tx.query("SELECT 1 FROM insurance_policies WHERE character_id = $1 AND kind = $2 AND renews", [c.id, kind]);
  if (renewing.rowCount) throw new GameError("already_insured", `You already have ${POLICIES[kind].name.toLowerCase()}.`);
  const week = insuranceWeek(now);
  const premium = premiumFor(kind, week.key);
  const paid = await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND kind = $2 AND period_key = $3", [c.id, `insurance_${kind}`, week.key]);
  const id = crypto.randomUUID();
  if (!paid.rowCount) {
    await moveMoney(tx, c, -premium, "insurance", `${POLICIES[kind].name} for week ${week.key}`, { type: "policy", id });
    await tx.query("INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at, paid_at) VALUES ($1,$2,$3,$4,$5,'paid',$6,$6)", [
      c.id,
      `insurance_${kind}`,
      week.key,
      `Insurance · ${POLICIES[kind].name} (${forecastFor(week.key).name.toLowerCase()})`,
      premium,
      now,
    ]);
  }
  await tx.query("INSERT INTO insurance_policies (id, character_id, kind, started_at) VALUES ($1,$2,$3,$4)", [id, c.id, kind, now]);
  await emit(tx, c.id, "insured", { kind }, now);
  return {
    message: `${POLICIES[kind].name} starts now${paid.rowCount ? " (this week is already paid)" : ` for ${fmtMoney(premium)} this week`}. It renews every Saturday at 09:00 with rent. Excess ${fmtMoney(POLICIES[kind].excessPence)}.`,
  };
}

export async function cancelInsurance(tx: Tx, accountId: string, p: { kind: PolicyKind }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const kind = policyKind(p.kind);
  const week = insuranceWeek(now);
  const res = await tx.query(
    "UPDATE insurance_policies SET renews = false, ended_at = $3, end_reason = 'cancelled' WHERE character_id = $1 AND kind = $2 AND renews RETURNING id",
    [c.id, kind, week.end],
  );
  if (!res.rowCount) throw new GameError("not_insured", `You don't have ${POLICIES[kind].name.toLowerCase()}.`);
  return { message: `${POLICIES[kind].name} won't renew. You're covered until ${londonClock(week.end)} on Saturday; premiums aren't refunded.` };
}

export async function claimInsurance(tx: Tx, accountId: string, p: { eventId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const ev = (await tx.query("SELECT * FROM hazard_events WHERE id::text = $1 AND character_id = $2 FOR UPDATE", [String(p.eventId ?? ""), c.id])).rows[0];
  if (!ev) throw new GameError("no_incident", "That incident isn't on your record.");
  if (!ev.insured) throw new GameError("not_covered", "You weren't covered when this happened, so there's nothing to claim. Cover never applies to past incidents.");
  if (ev.claimed_at) throw new GameError("already_claimed", "This claim has already been paid.");
  await tx.query("UPDATE hazard_events SET claimed_at = $2 WHERE id = $1", [ev.id, now]);
  const payout = Number(ev.payout_pence);
  const name = HAZARDS[ev.kind as HazardKind]?.name ?? "Incident";
  await moveMoney(tx, c, payout, "insurance", `Claim paid: ${name.toLowerCase()} (less ${fmtMoney(Number(ev.excess_pence))} excess)`, { type: "hazard", id: ev.id });
  return { message: payout ? `Claim paid: ${fmtMoney(payout)}.` : `Claim settled. The loss was within your ${fmtMoney(Number(ev.excess_pence))} excess, so nothing is paid.` };
}

// ───────────────────────────── pet commands ─────────────────────────────

export async function adoptPet(tx: Tx, accountId: string, p: { kind: PetKind; name: string; colour?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  if (p.kind !== "cat" && p.kind !== "dog") throw new GameError("bad_pet", "Choose a cat or a dog.");
  const def = PET_KINDS[p.kind];
  const name = String(p.name ?? "").trim();
  if (!/^[\p{L}][\p{L} '\-]{0,15}$/u.test(name)) throw new GameError("bad_name", "Give your pet a name of 1–16 letters.");
  const count = Number((await tx.query("SELECT count(*) AS n FROM pets WHERE character_id = $1 AND rehomed_at IS NULL", [c.id])).rows[0].n);
  if (count >= PET_RULES.maxPets) throw new GameError("too_many_pets", `You can look after up to ${PET_RULES.maxPets} pets at once.`);
  const colour = p.colour && def.colours.includes(p.colour) ? p.colour : def.colours[0];
  const id = crypto.randomUUID();
  await moveMoney(tx, c, -def.adoptionPence, "pets", `Adoption fee: ${name} the ${def.name.toLowerCase()}`, { type: "pet", id });
  await tx.query("INSERT INTO pets (id, character_id, kind, name, colour, wellbeing, settled_at, adopted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)", [
    id,
    c.id,
    p.kind,
    name,
    colour,
    PET_RULES.startWellbeing,
    now,
  ]);
  await emit(tx, c.id, "pet_adopted", { kind: p.kind }, now);
  return { message: `${name} has moved in! Feeding takes about ${def.foodPerDay} tin${def.foodPerDay > 1 ? "s" : ""} of pet food a day.` };
}

async function currentPet(tx: Tx, c: CharRow, petId: unknown) {
  const res = await tx.query("SELECT * FROM pets WHERE id::text = $1 AND character_id = $2 AND rehomed_at IS NULL FOR UPDATE", [String(petId ?? ""), c.id]);
  if (!res.rowCount) throw new GameError("no_pet", "That pet isn't living with you.");
  return res.rows[0];
}

export async function carePet(tx: Tx, accountId: string, p: { petId: string; action: PetCare }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const care = PET_CARE[p.action as PetCare];
  if (!care || !(Object.keys(PET_CARE) as string[]).includes(String(p.action))) throw new GameError("bad_action", "Unknown care action.");
  const pet = await currentPet(tx, c, p.petId);
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "You're travelling.");
  if (c.location !== "home") throw new GameError("not_home", `Go home to look after ${pet.name}.`);
  if (ctx.shift) throw new GameError("on_shift", "You're on shift.");
  if (ctx.running) throw new GameError("busy", "Finish or cancel what you're doing first.");
  const last = (pet.last_care ?? {}) as Record<string, string>;
  if (last[p.action]) {
    const ready = new Date(last[p.action]).getTime() + durationMs(care.cooldownMin);
    if (ready > now.getTime()) throw new GameError("cooldown", `${pet.name} has had enough of that for now. Try again at ${londonClock(new Date(ready))}.`);
  }
  for (const [item, qty] of Object.entries(care.consumes ?? {})) {
    if ((ctx.inv[item] ?? 0) < qty) throw new GameError("no_food", "You need a tin of pet food. Buy some at the Common Table Food Hall or Borough Market.");
  }
  if (care.consumes) await changeItems(tx, c.id, care.consumes, -1);
  const before = Number(pet.wellbeing);
  const after = Math.min(100, before + care.gain);
  await tx.query("UPDATE pets SET wellbeing = $2, settled_at = $3, last_care = $4, prompted = $5 WHERE id = $1", [
    pet.id,
    after,
    now,
    { ...last, [p.action]: now.toISOString() },
    after < PET_RULES.prompt,
  ]);
  if (care.owner) {
    c.needs = applyEffects(c.needs, care.owner);
    await saveNeeds(tx, c, now);
  }
  await emit(tx, c.id, "pet_cared", { action: p.action }, now);
  return { message: `${care.label === "Feed" ? `Fed ${pet.name}` : `${care.label}: ${pet.name}`}. Wellbeing ${Math.round(before)} → ${Math.round(after)}.` };
}

export async function rehomePet(tx: Tx, accountId: string, p: { petId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const pet = await currentPet(tx, c, p.petId);
  await tx.query("UPDATE pets SET rehomed_at = $2 WHERE id = $1", [pet.id, now]);
  await emit(tx, c.id, "pet_rehomed", { kind: pet.kind }, now);
  return { message: `${pet.name} is going to a caring new home through the Borough Animal Rescue (a fictional charity). Adoption fees aren't refunded.` };
}

// ───────────────────────────── view ─────────────────────────────

export async function lateGameView(tx: Tx, c: CharRow, now: Date) {
  const st = await lateState(tx, c, now);
  const vrows = (await tx.query("SELECT * FROM vehicles WHERE character_id = $1 AND status = 'owned' ORDER BY bought_at, id", [c.id])).rows;
  const garage = await garageFor(tx, c, now);
  const journey = (await tx.query("SELECT id FROM journeys WHERE character_id = $1 AND status = 'in_transit'", [c.id])).rows[0];
  const riding = journey ? vrows.find((v) => v.journey_id === journey.id) : undefined;
  const vehicles = vrows.map((v) => {
    const def = vehicleDef(v.def_id)!;
    const delivered = new Date(v.delivered_at) <= now;
    const cond = Number(v.condition);
    let reason: string | null = null;
    if (!delivered) reason = `Arrives at your home at ${londonClock(new Date(v.delivered_at))}.`;
    else if (v.journey_id) reason = "On the move with you.";
    else if (Number(v.owed_pence) > 0) reason = `Off the road: ${fmtMoney(Number(v.owed_pence))} upkeep unpaid.`;
    else if (cond < VEHICLE_RULES.minCondition) reason = `Unsafe below ${VEHICLE_RULES.minCondition}% condition. Service it to ride again.`;
    else if (v.location !== c.location) reason = `Parked at ${venue(v.location)?.name ?? v.location}.`;
    return {
      id: String(v.id),
      defId: def.id,
      name: def.name,
      mode: def.mode,
      colour: String(v.colour),
      condition: cond,
      trips: Number(v.trips),
      location: String(v.location),
      locationName: venue(v.location)?.name ?? String(v.location),
      deliveredAt: new Date(v.delivered_at).toISOString(),
      delivered,
      inUse: !!v.journey_id,
      owedPence: Number(v.owed_pence),
      upkeepPence: def.upkeepPence,
      tripPence: def.tripPence,
      resalePence: vehicleResale(Number(v.price_pence), cond),
      servicePence: serviceCost(def, cond),
      usableHere: !reason,
      reason,
    };
  });

  const week = insuranceWeek(now);
  const nextKey = londonWeekKey(week.end);
  const policyRows = (await tx.query("SELECT * FROM insurance_policies WHERE character_id = $1 AND (renews OR ended_at > $2) ORDER BY started_at DESC", [c.id, now])).rows;
  const paidThisWeek = new Set(
    (await tx.query("SELECT kind FROM bills WHERE character_id = $1 AND period_key = $2 AND kind LIKE 'insurance_%' AND status = 'paid'", [c.id, week.key])).rows.map((r) => String(r.kind)),
  );
  const policies = (Object.keys(POLICIES) as PolicyKind[]).map((kind) => {
    const rows = policyRows.filter((r) => r.kind === kind);
    const renewing = rows.find((r) => r.renews);
    const active = rows.find((r) => new Date(r.started_at) <= now && (!r.ended_at || new Date(r.ended_at) > now)) && paidThisWeek.has(`insurance_${kind}`);
    const def = POLICIES[kind];
    return {
      kind,
      name: def.name,
      blurb: def.blurb,
      exclusions: def.exclusions,
      covers: def.covers.map((h) => HAZARDS[h].name),
      excessPence: def.excessPence,
      premiumPence: premiumFor(kind, week.key),
      nextPremiumPence: premiumFor(kind, nextKey),
      active: !!active,
      renews: !!renewing,
      coveredUntil: active && !renewing ? week.end.toISOString() : null,
    };
  });
  const incidents = (await tx.query("SELECT * FROM hazard_events WHERE character_id = $1 ORDER BY occurred_at DESC LIMIT 8", [c.id])).rows.map((e) => ({
    id: String(e.id),
    kind: String(e.kind),
    name: HAZARDS[e.kind as HazardKind]?.name ?? String(e.kind),
    blurb: HAZARDS[e.kind as HazardKind]?.blurb ?? "",
    at: new Date(e.occurred_at).toISOString(),
    assessedPence: Number(e.assessed_loss_pence),
    chargedPence: Number(e.charged_pence),
    itemValuePence: Number(e.item_value_pence),
    reliefPence: Number(e.hardship_relief_pence),
    insured: !!e.insured,
    excessPence: Number(e.excess_pence),
    payoutPence: Number(e.payout_pence),
    claimed: !!e.claimed_at,
    claimable: !!e.insured && !e.claimed_at,
  }));

  const petRows = (await tx.query("SELECT * FROM pets WHERE character_id = $1 AND rehomed_at IS NULL ORDER BY adopted_at, id", [c.id])).rows;
  const food = Number((await tx.query("SELECT qty FROM inventory WHERE character_id = $1 AND item_id = $2", [c.id, PET_FOOD_ID])).rows[0]?.qty ?? 0);
  const pets = petRows.map((p) => {
    const last = (p.last_care ?? {}) as Record<string, string>;
    const wellbeing = Math.round(petWellbeing(Number(p.wellbeing), new Date(p.settled_at), now, p.kind as PetKind));
    return {
      id: String(p.id),
      kind: p.kind as PetKind,
      name: String(p.name),
      colour: String(p.colour),
      wellbeing,
      needsCare: wellbeing < PET_RULES.prompt,
      adoptedAt: new Date(p.adopted_at).toISOString(),
      care: (Object.keys(PET_CARE) as PetCare[]).map((id) => {
        const ready = last[id] ? new Date(last[id]).getTime() + durationMs(PET_CARE[id].cooldownMin) : 0;
        return { id, label: PET_CARE[id].label, blurb: PET_CARE[id].blurb, gain: PET_CARE[id].gain, readyAt: ready > now.getTime() ? new Date(ready).toISOString() : null };
      }),
    };
  });

  return {
    garage: {
      vehicles,
      catalogue: VEHICLES.map((v) => ({ ...v, resalePence: vehicleResale(v.pricePence, 100) })),
      maxOwned: VEHICLE_RULES.maxOwned,
      minCondition: VEHICLE_RULES.minCondition,
      deliveryMinutes: VEHICLE_RULES.deliveryMinutes,
      nextChargeAt: new Date(st.bills_due_at).toISOString(),
      cycleHere: garage.owned.cycle,
      driveHere: garage.owned.drive,
      riding: riding ? { defId: String(riding.def_id), colour: String(riding.colour) } : null,
    },
    insurance: {
      week: { key: week.key, endsAt: week.end.toISOString(), forecast: forecastFor(week.key) },
      next: { key: nextKey, forecast: forecastFor(nextKey) },
      policies,
      incidents,
      hardship: HARDSHIP,
      nextChargeAt: new Date(st.bills_due_at).toISOString(),
    },
    pets: {
      list: pets,
      petFood: food,
      kinds: (Object.keys(PET_KINDS) as PetKind[]).map((k) => ({ id: k, ...PET_KINDS[k] })),
      maxPets: PET_RULES.maxPets,
      prompt: PET_RULES.prompt,
      floor: PET_RULES.floor,
    },
  };
}
