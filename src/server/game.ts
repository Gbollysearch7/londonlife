import crypto from "node:crypto";
import { ALL_MISSIONS_BONUS, CONTENT_VERSION, DAILY_MISSION_SWAPS, FIRST_CARE_STARS, RESALE_FRACTION, START_NEEDS, URGENT_THRESHOLD } from "@/content/balance";
import { AMBITIONS, APPEARANCE_OPTIONS, HOME_TIERS, ORIGINS, TRAITS, type Appearance } from "@/content/character";
import { FURNITURE, ITEMS, furnitureDef, itemDef } from "@/content/catalogue";
import { ACTIVITIES, GROCERY_SHOP, MISSIONS, TRAVEL_MODES, VENUES, activityDef, journeyQuote, missionDef, venue, type TravelMode } from "@/content/world";
import { NEED_IDS, SKILL_IDS, type ActivityDef, type LocationId, type Needs, type SkillId } from "@/content/types";
import { NEED_CONSEQUENCES, NEED_LABELS, NEED_RECOVERY, applyEffects, settleNeeds } from "@/sim/needs";
import { placementError, type Placed } from "@/sim/placement";
import { computeMood, levelForXp, reputation, skillProgress, weatherFor, xpWithTraits } from "@/sim/progression";
import { assignMissions, layoutStarterHome, missionProgress, pickOrigin, swapMission, type EventRow } from "@/sim/setup";
import { durationMs, londonClock, londonDayKey, timeScale } from "@/sim/time";
import { GameError, type Tx } from "./db";

// ───────────────────────────── rows ─────────────────────────────

interface CharRow {
  id: string;
  account_id: string;
  name: string;
  appearance: Appearance;
  traits: string[];
  ambition: string;
  origin_id: string;
  location: LocationId;
  cash_pence: number;
  stars: number;
  reputation_xp: number;
  needs: Needs;
  needs_settled_at: Date;
  created_at: Date;
}

function toChar(r: Record<string, unknown>): CharRow {
  const needs = {} as Needs;
  for (const id of NEED_IDS) needs[id] = Number(r[id]);
  return {
    id: r.id as string,
    account_id: r.account_id as string,
    name: r.name as string,
    appearance: r.appearance as Appearance,
    traits: r.traits as string[],
    ambition: r.ambition as string,
    origin_id: r.origin_id as string,
    location: r.location as LocationId,
    cash_pence: Number(r.cash_pence),
    stars: Number(r.stars),
    reputation_xp: Number(r.reputation_xp),
    needs,
    needs_settled_at: r.needs_settled_at as Date,
    created_at: r.created_at as Date,
  };
}

async function lockCharacter(tx: Tx, accountId: string): Promise<CharRow | null> {
  const res = await tx.query("SELECT * FROM characters WHERE account_id = $1 FOR UPDATE", [accountId]);
  return res.rowCount ? toChar(res.rows[0]) : null;
}

async function requireCharacter(tx: Tx, accountId: string) {
  const c = await lockCharacter(tx, accountId);
  if (!c) throw new GameError("no_character", "Create your character first.", 409);
  return c;
}

// ─────────────────────────── primitives ───────────────────────────

const fmtMoney = (p: number) => `£${(p / 100).toFixed(2)}`;

async function moveMoney(
  tx: Tx,
  c: CharRow,
  amount: number,
  category: string,
  description: string,
  ref?: { type: string; id: string },
) {
  if (amount === 0) return;
  if (c.cash_pence + amount < 0) {
    throw new GameError("insufficient_funds", `You need ${fmtMoney(-amount)} but have ${fmtMoney(c.cash_pence)}.`);
  }
  const res = await tx.query("UPDATE characters SET cash_pence = cash_pence + $1 WHERE id = $2 RETURNING cash_pence", [amount, c.id]);
  c.cash_pence = Number(res.rows[0].cash_pence);
  await tx.query(
    `INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after, ref_type, ref_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [c.id, category, description, amount, c.cash_pence, ref?.type ?? null, ref?.id ?? null],
  );
}

async function inventoryOf(tx: Tx, charId: string): Promise<Record<string, number>> {
  const res = await tx.query("SELECT item_id, qty FROM inventory WHERE character_id = $1 AND qty > 0", [charId]);
  return Object.fromEntries(res.rows.map((r) => [r.item_id, Number(r.qty)]));
}

async function changeItems(tx: Tx, charId: string, items: Record<string, number>, sign: 1 | -1) {
  for (const [itemId, qty] of Object.entries(items)) {
    if (sign === 1) {
      await tx.query(
        `INSERT INTO inventory (character_id, item_id, qty) VALUES ($1, $2, $3)
         ON CONFLICT (character_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty`,
        [charId, itemId, qty],
      );
    } else {
      const res = await tx.query(
        "UPDATE inventory SET qty = qty - $3 WHERE character_id = $1 AND item_id = $2 AND qty >= $3",
        [charId, itemId, qty],
      );
      if (!res.rowCount) throw new GameError("missing_items", `You don't have enough ${itemDef(itemId)?.name ?? itemId}.`);
    }
  }
}

async function emit(tx: Tx, charId: string, type: string, data: Record<string, string>, now: Date) {
  await tx.query("INSERT INTO game_events (character_id, type, data, period_key, created_at) VALUES ($1, $2, $3, $4, $5)", [
    charId,
    type,
    data,
    londonDayKey(now),
    now,
  ]);
}

async function grantOnce(tx: Tx, charId: string, key: string, now: Date): Promise<boolean> {
  const res = await tx.query(
    "INSERT INTO once_rewards (character_id, reward_key, granted_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [charId, key, now],
  );
  return res.rowCount === 1;
}

async function addXp(tx: Tx, c: CharRow, skill: SkillId, base: number, now: Date) {
  const gained = xpWithTraits(skill, base, c.traits);
  const res = await tx.query(
    `UPDATE skills SET xp = xp + $3, last_used_at = $4 WHERE character_id = $1 AND skill_id = $2 RETURNING xp, best_level`,
    [c.id, skill, gained, now],
  );
  const xp = Number(res.rows[0].xp);
  const level = levelForXp(xp);
  const before = levelForXp(xp - gained);
  if (level > Number(res.rows[0].best_level)) {
    await tx.query("UPDATE skills SET best_level = $3 WHERE character_id = $1 AND skill_id = $2", [c.id, skill, level]);
  }
  return { skill, gained, level, levelledUp: level > before };
}

async function saveNeeds(tx: Tx, c: CharRow, now: Date) {
  await tx.query(
    `UPDATE characters SET hunger=$2, energy=$3, fun=$4, social=$5, hygiene=$6, bladder=$7, needs_settled_at=$8 WHERE id=$1`,
    [c.id, c.needs.hunger, c.needs.energy, c.needs.fun, c.needs.social, c.needs.hygiene, c.needs.bladder, now],
  );
  c.needs_settled_at = now;
}

// ─────────────────────────── home context ───────────────────────────

async function homeContext(tx: Tx, c: CharRow) {
  const home = (await tx.query("SELECT * FROM homes WHERE character_id = $1", [c.id])).rows[0];
  const tier = HOME_TIERS.find((t) => t.id === home.tier_id)!;
  const rows = (await tx.query("SELECT * FROM furniture WHERE character_id = $1 ORDER BY created_at, id", [c.id])).rows;
  const placed: Placed[] = rows
    .filter((r) => r.home_id)
    .map((r) => ({ id: r.id, defId: r.def_id, x: Number(r.x), y: Number(r.y), rot: Number(r.rot) }));
  const tags = new Set<string>();
  let bestBed = 0;
  let hasCooker = false;
  for (const p of placed) {
    const def = furnitureDef(p.defId)!;
    def.enables.forEach((t) => tags.add(t));
    if (def.enables.includes("bed")) bestBed = Math.max(bestBed, def.quality);
    if (def.enables.includes("hob") && def.quality >= 2) hasCooker = true;
  }
  return { home, tier, rows, placed, tags, bestBed, hasCooker };
}

type HomeCtx = Awaited<ReturnType<typeof homeContext>>;

/** Duration in real minutes before any development time scale. */
function activityMinutes(def: ActivityDef, home: HomeCtx) {
  return def.id.startsWith("cook_") && home.hasCooker ? Math.round(def.minutes * 0.7 * 10) / 10 : def.minutes;
}

// ─────────────────────────── settlement ───────────────────────────

/**
 * Brings a locked character up to `now`: needs decay, then any finished activity, then any arrived journey.
 * Safe to run on every request; each step is conditional on persisted status, so nothing settles twice.
 */
async function settle(tx: Tx, c: CharRow, now: Date) {
  const result = settleNeeds({ needs: c.needs, settledAt: c.needs_settled_at, now, traits: c.traits, createdAt: c.created_at });
  c.needs = result.needs;
  const notices: string[] = [];
  if (c.needs.bladder <= 0) {
    c.needs = { ...c.needs, bladder: 60, hygiene: Math.min(c.needs.hygiene, 10) };
    notices.push("You couldn't hold on any longer. Hygiene dropped — find a shower.");
    await emit(tx, c.id, "accident", {}, now);
  }
  await saveNeeds(tx, c, now);

  const due = await tx.query(
    "SELECT * FROM activities WHERE character_id = $1 AND status = 'running' AND ends_at <= $2",
    [c.id, now],
  );
  for (const row of due.rows) notices.push(...(await completeActivity(tx, c, row, now)));

  const arrived = await tx.query(
    `UPDATE journeys SET status = 'arrived', settled_at = $2
     WHERE character_id = $1 AND status = 'in_transit' AND arrives_at <= $2 RETURNING *`,
    [c.id, now],
  );
  for (const j of arrived.rows) {
    await tx.query("UPDATE characters SET location = $2 WHERE id = $1", [c.id, j.destination]);
    c.location = j.destination;
    await emit(tx, c.id, "journey_arrived", { mode: j.mode, destination: j.destination }, now);
    notices.push(`Arrived at ${venue(j.destination)?.name}.`);
  }
  return notices;
}

async function completeActivity(tx: Tx, c: CharRow, row: Record<string, unknown>, now: Date): Promise<string[]> {
  const def = activityDef(row.def_id as string)!;
  const claimed = await tx.query(
    "UPDATE activities SET status = 'completed', settled_at = $2 WHERE id = $1 AND status = 'running' RETURNING id",
    [row.id, now],
  );
  if (!claimed.rowCount) return [];
  const parts: string[] = [];
  const home = await homeContext(tx, c);

  const mult = def.id === "sleep" && home.bestBed >= 2 ? { energy: 1.1 } : {};
  const before = { ...c.needs };
  c.needs = applyEffects(c.needs, def.needs, mult);
  await saveNeeds(tx, c, now);
  for (const id of NEED_IDS) {
    const d = Math.round(c.needs[id] - before[id]);
    if (d) parts.push(`${NEED_LABELS[id]} ${d > 0 ? "+" : ""}${d}`);
  }

  let paid = 0;
  if (def.payPence) {
    const eligible = def.once ? await grantOnce(tx, c.id, `activity:${def.id}`, now) : true;
    if (eligible) {
      await moveMoney(tx, c, def.payPence, "income", def.label, { type: "activity", id: row.id as string });
      paid = def.payPence;
      parts.push(`earned ${fmtMoney(paid)}`);
    }
  }
  if (def.produces) {
    await changeItems(tx, c.id, def.produces, 1);
    for (const [id, q] of Object.entries(def.produces)) parts.push(`+${q} ${itemDef(id)?.name}`);
  }
  let xpInfo = null;
  if (def.xp) {
    xpInfo = await addXp(tx, c, def.xp.skill, def.xp.amount, now);
    parts.push(`${cap(def.xp.skill)} +${xpInfo.gained} XP${xpInfo.levelledUp ? ` — level ${xpInfo.level}!` : ""}`);
  }
  await emit(tx, c.id, def.event, { ...(def.eventData ?? {}), activity: def.id }, now);

  if ((def.event === "washed" || def.event === "toilet") && (await grantOnce(tx, c.id, "first_care", now))) {
    await tx.query("UPDATE characters SET stars = stars + $2 WHERE id = $1", [c.id, FIRST_CARE_STARS]);
    c.stars += FIRST_CARE_STARS;
    parts.push(`first-day bonus: +${FIRST_CARE_STARS} star`);
  }
  await tx.query("UPDATE activities SET result = $2 WHERE id = $1", [row.id, { summary: parts, paid, xp: xpInfo }]);
  return [`${def.label} done: ${parts.join(", ")}.`];
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ─────────────────────────── availability ───────────────────────────

interface Ctx {
  c: CharRow;
  home: HomeCtx;
  inv: Record<string, number>;
  skills: Record<string, number>;
  todayCounts: Record<string, number>;
  lastDone: Record<string, Date>;
  onceDone: Set<string>;
  running: Record<string, unknown> | null;
  journey: Record<string, unknown> | null;
  now: Date;
}

async function loadCtx(tx: Tx, c: CharRow, now: Date): Promise<Ctx> {
  const day = londonDayKey(now);
  // Sequential: one pg client cannot run queries concurrently.
  const home = await homeContext(tx, c);
  const inv = await inventoryOf(tx, c.id);
  const skillRows = await tx.query("SELECT skill_id, xp FROM skills WHERE character_id = $1", [c.id]);
  const counts = await tx.query(
    `SELECT def_id, count(*) FROM activities WHERE character_id = $1 AND period_key = $2 AND status IN ('running','completed') GROUP BY def_id`,
    [c.id, day],
  );
  const last = await tx.query(
    `SELECT def_id, max(settled_at) AS at FROM activities WHERE character_id = $1 AND status = 'completed' GROUP BY def_id`,
    [c.id],
  );
  const once = await tx.query("SELECT reward_key FROM once_rewards WHERE character_id = $1", [c.id]);
  const running = await tx.query("SELECT * FROM activities WHERE character_id = $1 AND status = 'running'", [c.id]);
  const journey = await tx.query("SELECT * FROM journeys WHERE character_id = $1 AND status = 'in_transit'", [c.id]);
  return {
    c,
    home,
    inv,
    skills: Object.fromEntries(skillRows.rows.map((r) => [r.skill_id, levelForXp(Number(r.xp))])),
    todayCounts: Object.fromEntries(counts.rows.map((r) => [r.def_id, Number(r.count)])),
    lastDone: Object.fromEntries(last.rows.map((r) => [r.def_id, r.at])),
    onceDone: new Set(once.rows.map((r) => r.reward_key)),
    running: running.rows[0] ?? null,
    journey: journey.rows[0] ?? null,
    now,
  };
}

/** The single source of truth for "can this start?" — used by both the action list and StartActivity. */
function activityBlocker(def: ActivityDef, ctx: Ctx): string | null {
  const { c } = ctx;
  if (ctx.journey) return "You're travelling.";
  if (ctx.running) return "Finish or cancel what you're doing first.";
  if (c.location !== def.location) return `Only at ${venue(def.location)?.name}.`;
  if (def.requires && !ctx.home.tags.has(def.requires)) return `Needs ${requirementName(def.requires)} placed at home.`;
  if (def.skillGate && (ctx.skills[def.skillGate.skill] ?? 0) < def.skillGate.level) {
    return `Needs ${cap(def.skillGate.skill)} level ${def.skillGate.level}.`;
  }
  for (const [item, qty] of Object.entries(def.consumes ?? {})) {
    if ((ctx.inv[item] ?? 0) < qty) return `Needs ${qty} × ${itemDef(item)?.name}.`;
  }
  if (def.costPence > c.cash_pence) return `Costs ${fmtMoney(def.costPence)}; you have ${fmtMoney(c.cash_pence)}.`;
  if (def.once && ctx.onceDone.has(`activity:${def.id}`)) return "Already completed — this one pays once.";
  if (def.dailyLimit && (ctx.todayCounts[def.id] ?? 0) >= def.dailyLimit) return `Limit of ${def.dailyLimit} per day reached.`;
  if (def.cooldownMin && ctx.lastDone[def.id]) {
    const readyAt = ctx.lastDone[def.id].getTime() + durationMs(def.cooldownMin);
    if (readyAt > ctx.now.getTime()) return `Available again at ${londonClock(new Date(readyAt))}.`;
  }
  if (def.minEnergy && c.needs.energy < def.minEnergy) return "Too tired. Rest first.";
  if (def.minHunger && c.needs.hunger < def.minHunger) return "Too hungry to work. Eat first.";
  return null;
}

const REQUIREMENT_NAMES: Record<string, string> = {
  bed: "a bed",
  nap: "a bed or sofa",
  hob: "a hob or cooker",
  fridge: "a fridge",
  shower: "a shower",
  toilet: "a toilet",
  tv: "a TV",
  seat: "a chair or sofa",
  books: "a bookshelf",
  desk: "a desk",
  guitar: "a guitar",
  weights: "a dumbbell rack",
};
const requirementName = (t: string) => REQUIREMENT_NAMES[t] ?? t;

// ─────────────────────────── commands ───────────────────────────

export interface CreateCharacterInput {
  name: string;
  appearance: Appearance;
  traits: string[];
  ambition: string;
}

export async function createCharacter(tx: Tx, accountId: string, input: CreateCharacterInput, now: Date, rand = Math.random) {
  const name = String(input.name ?? "").trim();
  if (!/^[\p{L}][\p{L} '\-]{0,23}$/u.test(name)) throw new GameError("bad_name", "Use 1–24 letters for your character's name.");
  const a = input.appearance ?? ({} as Appearance);
  for (const [k, opts] of Object.entries(APPEARANCE_OPTIONS)) {
    const v = (a as unknown as Record<string, unknown>)[k];
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= opts.length) {
      throw new GameError("bad_appearance", `Choose a ${k} option.`);
    }
  }
  const traits = input.traits ?? [];
  if (traits.length !== 2 || traits[0] === traits[1]) throw new GameError("bad_traits", "Choose exactly two different traits.");
  const defs = traits.map((t) => TRAITS.find((x) => x.id === t));
  if (defs.some((d) => !d)) throw new GameError("bad_traits", "Unknown trait.");
  if (defs[0]!.conflicts?.includes(defs[1]!.id)) throw new GameError("bad_traits", `${defs[0]!.name} and ${defs[1]!.name} can't be combined.`);
  if (!AMBITIONS.some((x) => x.id === input.ambition)) throw new GameError("bad_ambition", "Choose an ambition.");

  // One character per account: a repeat or racing request returns the existing character, never a reroll.
  const origin = pickOrigin(rand());
  const ins = await tx.query(
    `INSERT INTO characters (account_id, name, appearance, traits, ambition, origin_id, content_version, location, cash_pence,
       hunger, energy, fun, social, hygiene, bladder, needs_settled_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'home',0,$8,$8,$8,$8,$8,$8,$9,$9)
     ON CONFLICT (account_id) DO NOTHING RETURNING *`,
    [accountId, name, a, traits, input.ambition, origin.id, CONTENT_VERSION, START_NEEDS, now],
  );
  if (!ins.rowCount) return { created: false };
  const c = toChar(ins.rows[0]);
  const tier = HOME_TIERS.find((t) => t.id === origin.homeTier)!;
  const home = await tx.query("INSERT INTO homes (character_id, tier_id, district) VALUES ($1, $2, $3) RETURNING id", [
    c.id,
    tier.id,
    tier.district,
  ]);
  for (const { defId, spot } of layoutStarterHome(origin.furniture, tier.gridW, tier.gridD)) {
    const def = furnitureDef(defId)!;
    await tx.query(
      `INSERT INTO furniture (character_id, def_id, home_id, x, y, rot, colour, price_pence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [c.id, defId, spot ? home.rows[0].id : null, spot?.x ?? null, spot?.y ?? null, spot?.rot ?? 0, def.colours[0], def.pricePence],
    );
  }
  await changeItems(tx, c.id, origin.groceries, 1);
  for (const s of SKILL_IDS) {
    const lvl = origin.skills[s] ?? 0;
    const xp = [0, 100, 250][lvl] ?? 0;
    await tx.query("INSERT INTO skills (character_id, skill_id, xp, best_level) VALUES ($1,$2,$3,$4)", [c.id, s, xp, lvl]);
  }
  await moveMoney(tx, c, origin.cashPence, "origin", `Starting funds: ${origin.name}`);
  await emit(tx, c.id, "character_created", { origin: origin.id }, now);
  return { created: true };
}

export async function startActivity(tx: Tx, accountId: string, p: { activityId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = activityDef(p.activityId);
  if (!def) throw new GameError("unknown_activity", "That activity doesn't exist.");
  const ctx = await loadCtx(tx, c, now);
  const blocker = activityBlocker(def, ctx);
  if (blocker) throw new GameError("blocked", blocker);
  const minutes = activityMinutes(def, ctx.home);
  const id = crypto.randomUUID();
  // Costs are charged and ingredients consumed at start (visible cancel rule says so).
  await moveMoney(tx, c, -def.costPence, "spend", def.label, { type: "activity", id });
  if (def.consumes) await changeItems(tx, c.id, def.consumes, -1);
  await tx.query(
    `INSERT INTO activities (id, character_id, def_id, location, status, started_at, ends_at, cost_pence, period_key)
     VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8)`,
    [id, c.id, def.id, c.location, now, new Date(now.getTime() + durationMs(minutes)), def.costPence, londonDayKey(now)],
  );
  return { message: `${def.label} started.` };
}

export async function cancelActivity(tx: Tx, accountId: string, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const res = await tx.query(
    "UPDATE activities SET status = 'cancelled', settled_at = $2 WHERE character_id = $1 AND status = 'running' RETURNING def_id",
    [c.id, now],
  );
  if (!res.rowCount) throw new GameError("nothing_running", "Nothing to cancel — it may already have finished.");
  const def = activityDef(res.rows[0].def_id)!;
  return { message: `Cancelled ${def.label.toLowerCase()}. ${def.cancelRule}` };
}

export async function startJourney(tx: Tx, accountId: string, p: { destination: LocationId; mode: TravelMode }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  if (!venue(p.destination)) throw new GameError("bad_destination", "Unknown destination.");
  if (!(p.mode in TRAVEL_MODES)) throw new GameError("bad_mode", "Unknown travel mode.");
  if (p.destination === c.location) throw new GameError("already_there", "You're already here.");
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey) throw new GameError("travelling", "You're already travelling.");
  if (ctx.running) throw new GameError("busy", "Finish or cancel what you're doing first.");
  const q = journeyQuote(c.location, p.destination, p.mode);
  const id = crypto.randomUUID();
  await moveMoney(tx, c, -q.farePence, "travel", `${q.name} to ${venue(p.destination)!.name}`, { type: "journey", id });
  await tx.query(
    `INSERT INTO journeys (id, character_id, origin, destination, mode, fare_pence, status, departed_at, arrives_at)
     VALUES ($1,$2,$3,$4,$5,$6,'in_transit',$7,$8)`,
    [id, c.id, c.location, p.destination, p.mode, q.farePence, now, new Date(now.getTime() + durationMs(q.minutes))],
  );
  return { message: `${q.name === "Walk" ? "Walking" : "On the bus"} to ${venue(p.destination)!.name}.` };
}

export async function cancelJourney(tx: Tx, accountId: string, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const res = await tx.query(
    "UPDATE journeys SET status = 'cancelled', settled_at = $2 WHERE character_id = $1 AND status = 'in_transit' RETURNING origin, fare_pence",
    [c.id, now],
  );
  if (!res.rowCount) throw new GameError("not_travelling", "You're not travelling — you may already have arrived.");
  const fare = Number(res.rows[0].fare_pence);
  return { message: `Turned back to ${venue(res.rows[0].origin)!.name}.${fare ? " Bus fares aren't refunded." : ""}` };
}

export async function buyGroceries(tx: Tx, accountId: string, p: { itemId: string; qty: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  if (c.location !== GROCERY_SHOP.location) throw new GameError("wrong_place", `Groceries are sold at ${venue(GROCERY_SHOP.location)!.name}.`);
  const item = itemDef(p.itemId);
  const qty = Number(p.qty);
  if (!item || !GROCERY_SHOP.items.includes(item.id)) throw new GameError("bad_item", "That isn't sold here.");
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new GameError("bad_qty", "Buy between 1 and 10.");
  const total = item.pricePence! * qty;
  await moveMoney(tx, c, -total, "groceries", `${qty} × ${item.name}`);
  await changeItems(tx, c.id, { [item.id]: qty }, 1);
  await emit(tx, c.id, "groceries_bought", { item: item.id }, now);
  return { message: `Bought ${qty} × ${item.name} for ${fmtMoney(total)}.` };
}

export async function buyFurniture(tx: Tx, accountId: string, p: { defId: string; colour?: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = furnitureDef(p.defId);
  if (!def) throw new GameError("bad_item", "Unknown item.");
  const colour = p.colour && def.colours.includes(p.colour) ? p.colour : def.colours[0];
  const id = crypto.randomUUID();
  await moveMoney(tx, c, -def.pricePence, "furniture", def.name, { type: "furniture", id });
  await tx.query(
    "INSERT INTO furniture (id, character_id, def_id, colour, price_pence) VALUES ($1,$2,$3,$4,$5)",
    [id, c.id, def.id, colour, def.pricePence],
  );
  await emit(tx, c.id, "furniture_bought", { def: def.id }, now);
  return { message: `${def.name} bought and delivered to storage. Place it at home.`, instanceId: id };
}

async function ownedInstance(tx: Tx, c: CharRow, instanceId: string) {
  const res = await tx.query("SELECT * FROM furniture WHERE id = $1 AND character_id = $2", [instanceId, c.id]);
  if (!res.rowCount) throw new GameError("not_owned", "You don't own that item.");
  return res.rows[0];
}

async function requireHomeIdle(tx: Tx, c: CharRow, now: Date) {
  if (c.location !== "home") throw new GameError("not_home", "Go home to arrange furniture.");
  const ctx = await loadCtx(tx, c, now);
  if (ctx.running) throw new GameError("busy", "Finish or cancel what you're doing first.");
  return ctx;
}

export async function placeFurniture(tx: Tx, accountId: string, p: { instanceId: string; x: number; y: number; rot: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const ctx = await requireHomeIdle(tx, c, now);
  const inst = await ownedInstance(tx, c, p.instanceId);
  const candidate = { id: inst.id, defId: inst.def_id, x: Number(p.x), y: Number(p.y), rot: Number(p.rot) };
  const err = placementError(candidate, ctx.home.placed, ctx.home.tier.gridW, ctx.home.tier.gridD);
  if (err) throw new GameError("bad_placement", err);
  const wasStored = !inst.home_id;
  await tx.query("UPDATE furniture SET home_id = $2, x = $3, y = $4, rot = $5 WHERE id = $1", [
    inst.id,
    ctx.home.home.id,
    candidate.x,
    candidate.y,
    candidate.rot,
  ]);
  if (wasStored) await emit(tx, c.id, "furniture_placed", { def: inst.def_id }, now);
  return { message: `${furnitureDef(inst.def_id)!.name} ${wasStored ? "placed" : "moved"}.` };
}

export async function storeFurniture(tx: Tx, accountId: string, p: { instanceId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  await requireHomeIdle(tx, c, now);
  const inst = await ownedInstance(tx, c, p.instanceId);
  if (!inst.home_id) throw new GameError("already_stored", "Already in storage.");
  await tx.query("UPDATE furniture SET home_id = NULL, x = NULL, y = NULL WHERE id = $1", [inst.id]);
  return { message: `${furnitureDef(inst.def_id)!.name} moved to storage.` };
}

export async function sellFurniture(tx: Tx, accountId: string, p: { instanceId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  await requireHomeIdle(tx, c, now);
  const del = await tx.query("DELETE FROM furniture WHERE id = $1 AND character_id = $2 RETURNING def_id, price_pence", [
    p.instanceId,
    c.id,
  ]);
  if (!del.rowCount) throw new GameError("not_owned", "You don't own that item — it may already have been sold.");
  const value = Math.round(Number(del.rows[0].price_pence) * RESALE_FRACTION);
  const def = furnitureDef(del.rows[0].def_id)!;
  await moveMoney(tx, c, value, "sale", `Sold ${def.name}`, { type: "furniture", id: p.instanceId });
  return { message: `Sold ${def.name} for ${fmtMoney(value)}.` };
}

async function ensureAssignment(tx: Tx, c: CharRow, now: Date) {
  const day = londonDayKey(now);
  await tx.query(
    "INSERT INTO mission_assignments (character_id, period_key, mission_ids) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    [c.id, day, assignMissions(c.id, day)],
  );
  const row = (await tx.query("SELECT * FROM mission_assignments WHERE character_id = $1 AND period_key = $2", [c.id, day])).rows[0];
  const events = (await tx.query("SELECT type, data FROM game_events WHERE character_id = $1 AND period_key = $2", [c.id, day]))
    .rows as EventRow[];
  const claims = (await tx.query("SELECT mission_id FROM mission_claims WHERE character_id = $1 AND period_key = $2", [c.id, day]))
    .rows.map((r) => r.mission_id as string);
  return { day, ids: row.mission_ids as string[], swapsUsed: Number(row.swaps_used), events, claims };
}

export async function claimMission(tx: Tx, accountId: string, p: { missionId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const a = await ensureAssignment(tx, c, now);
  let reward: { pence: number; rep: number; stars?: number };
  let title: string;
  if (p.missionId === "all_three") {
    if (!a.ids.every((id) => a.claims.includes(id))) throw new GameError("not_ready", "Claim all three missions first.");
    reward = ALL_MISSIONS_BONUS;
    title = "All three daily missions";
  } else {
    const def = missionDef(p.missionId);
    if (!def || !a.ids.includes(def.id)) throw new GameError("not_assigned", "That isn't one of today's missions.");
    if (missionProgress(def, a.events) < def.target) throw new GameError("not_ready", "Not complete yet.");
    reward = def.reward;
    title = def.title;
  }
  const ins = await tx.query(
    "INSERT INTO mission_claims (character_id, period_key, mission_id, reward, claimed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [c.id, a.day, p.missionId, reward, now],
  );
  if (!ins.rowCount) throw new GameError("already_claimed", "Already claimed.");
  await moveMoney(tx, c, reward.pence, "mission", `Mission: ${title}`);
  await tx.query("UPDATE characters SET reputation_xp = reputation_xp + $2, stars = stars + $3 WHERE id = $1", [
    c.id,
    reward.rep,
    reward.stars ?? 0,
  ]);
  return { message: `Claimed: ${fmtMoney(reward.pence)}, +${reward.rep} reputation${reward.stars ? `, +${reward.stars} stars` : ""}.` };
}

export async function swapDailyMission(tx: Tx, accountId: string, p: { missionId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const a = await ensureAssignment(tx, c, now);
  if (a.swapsUsed >= DAILY_MISSION_SWAPS) throw new GameError("no_swaps", "You've used today's free swap.");
  if (!a.ids.includes(p.missionId)) throw new GameError("not_assigned", "That isn't one of today's missions.");
  if (a.claims.includes(p.missionId)) throw new GameError("claimed", "Claimed missions can't be swapped.");
  const replacement = swapMission(a.ids, p.missionId);
  if (!replacement) throw new GameError("no_replacement", "No other mission is available in that category.");
  await tx.query(
    "UPDATE mission_assignments SET mission_ids = array_replace(mission_ids, $3, $4), swaps_used = swaps_used + 1 WHERE character_id = $1 AND period_key = $2",
    [c.id, a.day, p.missionId, replacement],
  );
  return { message: `Swapped for “${missionDef(replacement)!.title}”.` };
}

// ─────────────────────────── canonical state ───────────────────────────

export async function loadState(tx: Tx, accountId: string, now: Date) {
  const c = await lockCharacter(tx, accountId);
  if (!c) return { character: null, now: now.toISOString() };
  const notices = await settle(tx, c, now);
  const ctx = await loadCtx(tx, c, now);
  const day = londonDayKey(now);
  const weather = weatherFor(day);
  const mood = computeMood(c.needs, ctx.home.placed.map((p) => p.defId), weather);
  const a = await ensureAssignment(tx, c, now);

  const skillRows = (await tx.query("SELECT skill_id, xp, best_level FROM skills WHERE character_id = $1", [c.id])).rows;
  const skills = SKILL_IDS.map((id) => {
    const r = skillRows.find((x) => x.skill_id === id);
    return { id, name: id === "enterprise" ? "Enterprise" : cap(id), ...skillProgress(Number(r?.xp ?? 0)) };
  });

  const ledger = (await tx.query("SELECT * FROM ledger_entries WHERE character_id = $1 ORDER BY id DESC LIMIT 30", [c.id])).rows.map((r) => ({
    id: Number(r.id),
    category: r.category,
    description: r.description,
    amountPence: Number(r.amount_pence),
    balanceAfter: Number(r.balance_after),
    at: r.created_at,
  }));

  const anyEvents = new Set(
    (await tx.query("SELECT DISTINCT type FROM game_events WHERE character_id = $1", [c.id])).rows.map((r) => r.type as string),
  );
  const anyClaim = (await tx.query("SELECT 1 FROM mission_claims WHERE character_id = $1 LIMIT 1", [c.id])).rowCount! > 0;

  const actions = ACTIVITIES.filter((d) => d.location === c.location).map((d) => {
    const blocker = activityBlocker(d, ctx);
    return {
      id: d.id,
      label: d.label,
      description: d.description,
      minutes: activityMinutes(d, ctx.home),
      costPence: d.costPence,
      payPence: d.payPence ?? 0,
      needs: d.needs,
      xp: d.xp ? { skill: d.xp.skill, amount: xpWithTraits(d.xp.skill, d.xp.amount, c.traits) } : null,
      consumes: Object.entries(d.consumes ?? {}).map(([id, qty]) => ({ id, name: itemDef(id)?.name ?? id, qty })),
      produces: Object.entries(d.produces ?? {}).map(([id, qty]) => ({ id, name: itemDef(id)?.name ?? id, qty })),
      cancelRule: d.cancelRule,
      npc: d.npc ?? null,
      group: d.id.startsWith("cook_") ? "Cook" : d.id.startsWith("eat_") || d.id === "snack" ? "Eat" : d.payPence ? "Earn" : d.xp ? "Learn" : "Care",
      available: !blocker,
      reason: blocker,
      hidden: d.id.startsWith("eat_") && !(ctx.inv[d.consumes ? Object.keys(d.consumes)[0] : ""] > 0),
    };
  });

  const running = ctx.running
    ? {
        id: String(ctx.running.id),
        defId: String(ctx.running.def_id),
        label: activityDef(ctx.running.def_id as string)!.label,
        startedAt: (ctx.running.started_at as Date).toISOString(),
        endsAt: (ctx.running.ends_at as Date).toISOString(),
        cancelRule: activityDef(ctx.running.def_id as string)!.cancelRule,
        anchor: activityDef(ctx.running.def_id as string)!.anchor ?? null,
      }
    : null;
  const journey = ctx.journey
    ? {
        origin: ctx.journey.origin as LocationId,
        destination: ctx.journey.destination as LocationId,
        mode: ctx.journey.mode as TravelMode,
        departedAt: (ctx.journey.departed_at as Date).toISOString(),
        arrivesAt: (ctx.journey.arrives_at as Date).toISOString(),
        farePence: Number(ctx.journey.fare_pence),
      }
    : null;

  const origin = ORIGINS.find((o) => o.id === c.origin_id)!;
  const ambition = AMBITIONS.find((x) => x.id === c.ambition)!;
  const music = skills.find((s) => s.id === "music")!;

  return {
    now: now.toISOString(),
    timeScale: timeScale(),
    clock: londonClock(now),
    day,
    weather,
    notices,
    character: {
      id: c.id,
      name: c.name,
      appearance: c.appearance,
      traits: c.traits.map((t) => TRAITS.find((x) => x.id === t)!),
      origin: { id: origin.id, name: origin.name, story: origin.story, perks: origin.perks, cashPence: origin.cashPence },
      ambition: {
        ...ambition,
        progress: ambition.id === "music_master" ? music.level / 10 : null,
        note: ambition.id === "music_master" ? `Music level ${music.level} of 10` : "Progress tracking arrives with careers, housing, friendships and companies (Milestones 2–3).",
      },
      location: c.location,
      stars: c.stars,
      reputation: reputation(c.reputation_xp),
      createdAt: c.created_at,
    },
    wallet: { cashPence: c.cash_pence },
    needs: c.needs,
    warnings: NEED_IDS.filter((id) => c.needs[id] <= URGENT_THRESHOLD).map((id) => ({
      need: id,
      label: NEED_LABELS[id],
      consequence: NEED_CONSEQUENCES[id],
      recovery: NEED_RECOVERY[id],
    })),
    mood,
    skills,
    inventory: Object.entries(ctx.inv).map(([id, qty]) => ({ id, qty, name: itemDef(id)?.name ?? id, kind: itemDef(id)?.kind ?? "grocery" })),
    home: { id: ctx.home.home.id, tier: ctx.home.tier, district: ctx.home.home.district },
    furniture: ctx.home.rows.map((r) => ({
      id: r.id,
      defId: r.def_id,
      name: furnitureDef(r.def_id)?.name ?? r.def_id,
      colour: r.colour,
      placed: !!r.home_id,
      x: r.x === null ? null : Number(r.x),
      y: r.y === null ? null : Number(r.y),
      rot: Number(r.rot),
      resalePence: Math.round(Number(r.price_pence) * RESALE_FRACTION),
    })),
    activity: running,
    journey,
    actions,
    groceries:
      c.location === GROCERY_SHOP.location && !journey
        ? GROCERY_SHOP.items.map((id) => ({ id, name: itemDef(id)!.name, pricePence: itemDef(id)!.pricePence!, unit: itemDef(id)!.unit }))
        : [],
    directory: VENUES.map((v) => ({
      id: v.id,
      name: v.name,
      district: v.district,
      blurb: v.blurb,
      opening: v.opening,
      access: v.access,
      npcs: v.npcs,
      here: c.location === v.id,
      quotes: c.location === v.id ? [] : (Object.keys(TRAVEL_MODES) as TravelMode[]).map((m) => journeyQuote(c.location, v.id, m)),
    })),
    missions: {
      day: a.day,
      swapsLeft: DAILY_MISSION_SWAPS - a.swapsUsed,
      items: a.ids.map((id) => {
        const def = missionDef(id)!;
        const progress = missionProgress(def, a.events);
        return { id, pool: def.pool, title: def.title, target: def.target, progress, reward: def.reward, claimed: a.claims.includes(id), claimable: progress >= def.target && !a.claims.includes(id) };
      }),
      bonus: { reward: ALL_MISSIONS_BONUS, claimed: a.claims.includes("all_three"), claimable: a.ids.every((id) => a.claims.includes(id)) && !a.claims.includes("all_three") },
    },
    tutorial: [
      { id: "create", label: "Create your character", done: true },
      { id: "eat", label: "Make or buy a meal and eat it", done: anyEvents.has("meal_eaten") },
      { id: "care", label: "Shower or use the toilet (+1 star, once)", done: ctx.onceDone.has("first_care") },
      { id: "travel", label: "Walk or take the bus to a venue", done: anyEvents.has("journey_arrived") },
      { id: "greet", label: "Chat with a local", done: anyEvents.has("npc_chat") },
      { id: "task", label: "Help Bev at The Common Room (£20)", done: ctx.onceDone.has("activity:community_lunch_setup") },
      { id: "career", label: "Choose a career or course", done: false, locked: "Careers and courses open in Milestone 2." },
      { id: "furnish", label: "Buy and place a piece of furniture", done: anyEvents.has("furniture_placed") },
      { id: "mission", label: "Claim a daily mission", done: anyClaim },
    ],
    ledger,
    catalogue: FURNITURE,
    groceryItems: ITEMS.filter((i) => i.kind === "grocery"),
  };
}

export type GameState = Awaited<ReturnType<typeof loadState>>;
