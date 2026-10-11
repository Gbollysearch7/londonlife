import { HOME_TIERS } from "@/content/character";
import { FRIEND_TIERS, friendTier } from "@/content/goals";
import { CHEF_MEALS, CHEF_MEALS_PER_DAY, CLEANER_MOOD, OUTAGE_KINDS, PARTY, PARTY_IDS, STAFF, staffDef, utilitiesFor } from "@/content/household";
import type { ActivityDef } from "@/content/types";
import { VENUES, hourLabel } from "@/content/world";
import { applyEffects } from "@/sim/needs";
import { outageBlocks, weekOutage } from "@/sim/outage";
import { londonWeekKey, londonWeekday, seededRandom } from "@/sim/shift";
import { londonDayKey, londonHour, nextLondonWeekly } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { RENT_DAY } from "./economy";
import { changeItems, emit, fmtMoney, moveMoney, requireCharacter, saveNeeds, settle, type CharRow, type Ctx } from "./game";
import { grantMoodlet } from "./goals";

const WEEK_MS = 7 * 86_400_000;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ───────────────────────────── bills ─────────────────────────────

/** The household bill schedule. New characters start with rent; older ones are never back-billed more than a week. */
async function ensureHousehold(tx: Tx, c: CharRow, now: Date) {
  const start = new Date(Math.max(new Date(c.created_at).getTime(), now.getTime() - WEEK_MS));
  await tx.query("INSERT INTO household (character_id, bills_due_at) VALUES ($1, $2) ON CONFLICT DO NOTHING", [c.id, nextLondonWeekly(start, RENT_DAY.isoWeekday, RENT_DAY.hour)]);
  return (await tx.query("SELECT * FROM household WHERE character_id = $1 FOR UPDATE", [c.id])).rows[0];
}

async function activeStaff(tx: Tx, charId: string) {
  return (await tx.query("SELECT * FROM staff WHERE character_id = $1 AND ended_at IS NULL ORDER BY hired_at", [charId])).rows;
}

/** Pays from the wallet, then savings. Returns false when neither covers it. */
async function payFromFunds(tx: Tx, c: CharRow, amount: number, description: string, ref: string, now: Date) {
  if (c.cash_pence >= amount) {
    await moveMoney(tx, c, -amount, "bills", description, { type: "bill", id: ref });
    return true;
  }
  const res = await tx.query("UPDATE characters SET savings_pence = savings_pence - $2 WHERE id = $1 AND savings_pence >= $2 RETURNING savings_pence", [c.id, amount]);
  if (!res.rowCount) return false;
  await tx.query("INSERT INTO savings_entries (character_id, kind, amount_pence, balance_after, created_at) VALUES ($1,'withdraw',$2,$3,$4)", [c.id, -amount, Number(res.rows[0].savings_pence), now]);
  return true;
}

/**
 * Brings household obligations up to date (runs after rent, so rent has priority):
 * staff who no longer fit the home leave; then each Saturday 09:00 bills utilities once and staff wages once.
 * Utilities are covered during the starting rent support; owned homes still pay them.
 * Wages that can't be paid mean the staff leave (no debt is created for work they won't do).
 */
export async function settleHousehold(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const home = (await tx.query("SELECT * FROM homes WHERE character_id = $1", [c.id])).rows[0];
  if (!home) return notices;
  const tier = HOME_TIERS.find((t) => t.id === home.tier_id)!;
  for (const s of await activeStaff(tx, c.id)) {
    const def = staffDef(s.role)!;
    if (tier.gridW < def.minGrid) {
      await tx.query("UPDATE staff SET ended_at = $2, end_reason = 'home_too_small' WHERE id = $1", [s.id, now]);
      notices.push(`Your ${def.name.toLowerCase()} has left: a ${tier.name.toLowerCase()} is too small (${def.blurb.toLowerCase()}). Wages already paid aren't refunded.`);
    }
  }
  const hh = await ensureHousehold(tx, c, now);
  let due = new Date(hh.bills_due_at);
  for (let guard = 0; due <= now && guard < 12; guard++) {
    const period = londonWeekKey(due);
    const amount = utilitiesFor(tier.id);
    const covered = !!home.rent_free_until && due < new Date(home.rent_free_until);
    const ins = await tx.query(
      "INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at) VALUES ($1,'utilities',$2,$3,$4,'unpaid',$5) ON CONFLICT DO NOTHING RETURNING id",
      [c.id, period, `Energy and water · ${tier.name}`, amount, due],
    );
    if (ins.rowCount) {
      const id = String(ins.rows[0].id);
      if (covered) {
        await tx.query("UPDATE bills SET status = 'covered', paid_at = $2 WHERE id = $1", [id, now]);
        notices.push("This week's energy and water are covered by your starting support.");
      } else if (await payFromFunds(tx, c, amount, `Energy and water for week ${period}`, id, now)) {
        await tx.query("UPDATE bills SET status = 'paid', paid_at = $2 WHERE id = $1", [id, now]);
        notices.push(`Energy and water paid: ${fmtMoney(amount)}.`);
      } else notices.push(`Energy and water of ${fmtMoney(amount)} is unpaid — pay it from the Bank app when you can.`);
    }
    const staff = (await activeStaff(tx, c.id)).filter((s) => new Date(s.hired_at) <= due);
    const wages = staff.reduce((t, s) => t + Number(s.wage_pence), 0);
    if (wages > 0) {
      const names = staff.map((s) => staffDef(s.role)!.name.toLowerCase()).join(" and ");
      const wIns = await tx.query(
        "INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at) VALUES ($1,'staff',$2,$3,$4,'unpaid',$5) ON CONFLICT DO NOTHING RETURNING id",
        [c.id, period, `Staff wages · ${names}`, wages, due],
      );
      if (wIns.rowCount) {
        const id = String(wIns.rows[0].id);
        if (await payFromFunds(tx, c, wages, `Staff wages for week ${period} (${names})`, id, now)) {
          await tx.query("UPDATE bills SET status = 'paid', paid_at = $2 WHERE id = $1", [id, now]);
          notices.push(`Staff wages paid: ${fmtMoney(wages)}.`);
        } else {
          // Nothing is owed for a week they won't work: the bill is dropped and the staff leave.
          await tx.query("DELETE FROM bills WHERE id = $1", [id]);
          for (const s of staff) await tx.query("UPDATE staff SET ended_at = $2, end_reason = 'unpaid' WHERE id = $1", [s.id, due]);
          notices.push(`Your ${names} couldn't be paid ${fmtMoney(wages)} this week, so they've left. You can hire again from the Staff app.`);
        }
      }
    }
    due = nextLondonWeekly(due, RENT_DAY.isoWeekday, RENT_DAY.hour);
  }
  if (due.getTime() !== new Date(hh.bills_due_at).getTime()) await tx.query("UPDATE household SET bills_due_at = $2 WHERE character_id = $1", [c.id, due]);
  return notices;
}

// ───────────────────────────── staff commands ─────────────────────────────

/** First wages run from now to the next bill time (Saturday 09:00), rounded up to whole pence. */
export function proratedWage(wagePence: number, now: Date, nextDue: Date) {
  const frac = Math.max(0, Math.min(1, (nextDue.getTime() - now.getTime()) / WEEK_MS));
  return Math.ceil(wagePence * frac);
}

export async function hireStaff(tx: Tx, accountId: string, p: { role: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = staffDef(String(p.role ?? ""));
  if (!def) throw new GameError("bad_role", "Unknown staff role.");
  const home = (await tx.query("SELECT tier_id FROM homes WHERE character_id = $1", [c.id])).rows[0];
  const tier = HOME_TIERS.find((t) => t.id === home.tier_id)!;
  if (tier.gridW < def.minGrid) throw new GameError("not_eligible", `There's no room for a ${def.name.toLowerCase()} in a ${tier.name.toLowerCase()}. ${def.blurb}`);
  if ((await activeStaff(tx, c.id)).some((s) => s.role === def.id)) throw new GameError("already_hired", `You already have a ${def.name.toLowerCase()}.`);
  if ((await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND status = 'unpaid' LIMIT 1", [c.id])).rowCount) {
    throw new GameError("arrears", "Pay your unpaid bills (Bank app) before hiring staff.");
  }
  const hh = await ensureHousehold(tx, c, now);
  const first = proratedWage(def.wagePence, now, new Date(hh.bills_due_at));
  const ins = await tx.query("INSERT INTO staff (character_id, role, wage_pence, hired_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id", [c.id, def.id, def.wagePence, now]);
  if (!ins.rowCount) throw new GameError("already_hired", `You already have a ${def.name.toLowerCase()}.`);
  if (first > 0) {
    if (c.cash_pence < first) throw new GameError("insufficient_funds", `The first wages are ${fmtMoney(first)} (to Saturday 09:00); you have ${fmtMoney(c.cash_pence)}.`);
    await moveMoney(tx, c, -first, "staff", `${def.name}: first wages to Saturday`, { type: "staff", id: String(ins.rows[0].id) });
  }
  await emit(tx, c.id, "staff_hired", { role: def.id }, now);
  return { message: `${def.name} hired. First wages ${fmtMoney(first)}; then ${fmtMoney(def.wagePence)} every Saturday with your bills.` };
}

export async function fireStaff(tx: Tx, accountId: string, p: { role: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = staffDef(String(p.role ?? ""));
  if (!def) throw new GameError("bad_role", "Unknown staff role.");
  const res = await tx.query("UPDATE staff SET ended_at = $3, end_reason = 'fired' WHERE character_id = $1 AND role = $2 AND ended_at IS NULL RETURNING id", [c.id, def.id, now]);
  if (!res.rowCount) throw new GameError("not_hired", `You don't have a ${def.name.toLowerCase()}.`);
  return { message: `Your ${def.name.toLowerCase()} has finished working for you. Wages already paid aren't refunded.` };
}

async function hasStaff(tx: Tx, charId: string, role: string) {
  return (await tx.query("SELECT 1 FROM staff WHERE character_id = $1 AND role = $2 AND ended_at IS NULL", [charId, role])).rowCount! > 0;
}

function dayHash(s: string) {
  return Math.floor(seededRandom(s)() * 1000);
}

/** The chef's dish for a given serving of the day (rotates, deterministic). */
export const chefDish = (day: string, serving: number) => CHEF_MEALS[(dayHash(`chef:${day}`) + serving) % CHEF_MEALS.length];

export async function collectChefMeal(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  if (!(await hasStaff(tx, c.id, "chef"))) throw new GameError("no_chef", "Hire a chef in the Staff app first.");
  const travelling = (await tx.query("SELECT 1 FROM journeys WHERE character_id = $1 AND status = 'in_transit'", [c.id])).rowCount;
  if (c.location !== "home" || travelling) throw new GameError("not_home", "Your chef cooks at home. Go home to collect a meal.");
  const day = londonDayKey(now);
  const res = await tx.query(
    `INSERT INTO chef_meals (character_id, day_key, served) VALUES ($1, $2, 1)
     ON CONFLICT (character_id, day_key) DO UPDATE SET served = chef_meals.served + 1 WHERE chef_meals.served < $3 RETURNING served`,
    [c.id, day, CHEF_MEALS_PER_DAY],
  );
  if (!res.rowCount) throw new GameError("chef_limit", `Your chef has made ${CHEF_MEALS_PER_DAY} meals today. More tomorrow.`);
  const served = Number(res.rows[0].served);
  const dish = chefDish(day, served - 1);
  await changeItems(tx, c.id, { [dish.id]: 1 }, 1);
  await emit(tx, c.id, "chef_meal", { item: dish.id }, now);
  return { message: `Your chef made ${dish.name.toLowerCase()}. It's in your kitchen cupboard (${served}/${CHEF_MEALS_PER_DAY} today).` };
}

// ───────────────────────────── activity hooks ─────────────────────────────

/** Household rules for "can this start?": outages and one party a night. Called from activityBlocker. */
export function householdBlocker(def: ActivityDef, ctx: Ctx): string | null {
  if (def.location === "home" && def.requires) {
    const o = outageBlocks(ctx.c.id, ctx.now, def.requires);
    if (o) {
      const k = OUTAGE_KINDS[o.kind];
      return `${k.name} at home until ${hourLabel(o.endHour)}. ${k.recovery}`;
    }
  }
  if (PARTY_IDS.includes(def.id) && PARTY_IDS.reduce((n, id) => n + (ctx.todayCounts[id] ?? 0), 0) >= 1) {
    return "You've already thrown a party tonight. One a night!";
  }
  return null;
}

/** Authored NPCs you're at least Friends with, closest first. Friendship grows from time spent together. */
async function partyFriends(tx: Tx, charId: string) {
  const rows = (await tx.query("SELECT data->>'npc' AS npc, count(*) AS n FROM game_events WHERE character_id = $1 AND type = 'npc_time' GROUP BY 1", [charId])).rows;
  const points = Object.fromEntries(rows.map((r) => [r.npc, Number(r.n)]));
  return VENUES.flatMap((v) => v.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, points: points[n.id] ?? 0 })))
    .filter((f) => friendTier(f.points).level >= PARTY.friendTier)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/** Runs once when a party activity completes (inside its settlement): NPC friends arrive and add to the night. */
export async function partyCompleted(tx: Tx, c: CharRow, row: Record<string, unknown>, now: Date): Promise<string[]> {
  const guests = (await partyFriends(tx, c.id)).slice(0, PARTY.maxGuests);
  const ins = await tx.query("INSERT INTO house_parties (activity_id, character_id, guests, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [
    row.id,
    c.id,
    JSON.stringify(guests.map((g) => ({ id: g.id, name: g.name }))),
    now,
  ]);
  if (!ins.rowCount) return [];
  const parts: string[] = [];
  if (guests.length) {
    c.needs = applyEffects(c.needs, { social: PARTY.perGuest.social * guests.length, fun: PARTY.perGuest.fun * guests.length });
    await saveNeeds(tx, c, now);
    parts.push(`NPC guests came: ${guests.map((g) => g.name).join(", ")} (locals, not players) — Social +${PARTY.perGuest.social * guests.length}`);
  } else parts.push(`a quiet one — reach ${FRIEND_TIERS[PARTY.friendTier].title} with locals and they'll come next time`);
  const m = await grantMoodlet(tx, c, "party_host", "house_party", now);
  if (m) parts.push(`feeling: ${m.toLowerCase()}`);
  return parts;
}

export async function householdMood(tx: Tx, c: CharRow): Promise<{ label: string; strength: number }[]> {
  return (await hasStaff(tx, c.id, "cleaner")) ? [{ label: "Spotless home (cleaner)", strength: CLEANER_MOOD }] : [];
}

// ───────────────────────────── view ─────────────────────────────

export async function householdView(tx: Tx, c: CharRow, ctx: Ctx, now: Date) {
  const tier = ctx.home.tier;
  const hh = (await tx.query("SELECT bills_due_at FROM household WHERE character_id = $1", [c.id])).rows[0];
  const nextDue = hh ? new Date(hh.bills_due_at) : nextLondonWeekly(now, RENT_DAY.isoWeekday, RENT_DAY.hour);
  const staffRows = await activeStaff(tx, c.id);
  const served = Number((await tx.query("SELECT served FROM chef_meals WHERE character_id = $1 AND day_key = $2", [c.id, londonDayKey(now)])).rows[0]?.served ?? 0);
  const o = weekOutage(c.id, now);
  const wd = londonWeekday(now);
  const h = londonHour(now);
  const outageState = o ? (wd < o.weekday || (wd === o.weekday && h < o.startHour) ? "upcoming" : wd === o.weekday && h < o.endHour ? "active" : "over") : null;
  const last = (await tx.query("SELECT guests, created_at FROM house_parties WHERE character_id = $1 ORDER BY created_at DESC LIMIT 1", [c.id])).rows[0];
  const friends = await partyFriends(tx, c.id);
  const partiesTonight = PARTY_IDS.reduce((n, id) => n + (ctx.todayCounts[id] ?? 0), 0);
  const utilities = utilitiesFor(tier.id);
  return {
    household: {
      utilitiesPence: utilities,
      wagesPence: staffRows.reduce((t, s) => t + Number(s.wage_pence), 0),
      nextBillAt: nextDue.toISOString(),
      outage: o
        ? {
            kind: o.kind,
            name: OUTAGE_KINDS[o.kind].name,
            blurb: OUTAGE_KINDS[o.kind].blurb,
            recovery: OUTAGE_KINDS[o.kind].recovery,
            when: `${DAY_NAMES[o.weekday - 1]} ${hourLabel(o.startHour)}–${hourLabel(o.endHour)}`,
            state: outageState as "upcoming" | "active" | "over",
          }
        : null,
      staff: STAFF.map((d) => {
        const row = staffRows.find((s) => s.role === d.id);
        return {
          id: d.id,
          name: d.name,
          wagePence: d.wagePence,
          services: d.services,
          blurb: d.blurb,
          eligible: tier.gridW >= d.minGrid,
          hired: !!row,
          hiredAt: row ? new Date(row.hired_at).toISOString() : null,
          firstWagesPence: proratedWage(d.wagePence, now, nextDue),
        };
      }),
      chef: { mealsToday: served, max: CHEF_MEALS_PER_DAY },
      party: {
        hasSpeakers: ctx.home.tags.has("speakers"),
        thrownTonight: partiesTonight > 0,
        guests: friends.slice(0, PARTY.maxGuests).map((f) => ({ id: f.id, name: f.name, role: f.role })),
        last: last ? { at: new Date(last.created_at).toISOString(), guests: (last.guests as { name: string }[]).map((g) => g.name) } : null,
      },
    },
  };
}
