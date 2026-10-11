import { CONDITIONS, DELIVERY, DELIVERY_MENU, ONSET_NEEDS, type ConditionId } from "@/content/health";
import { itemDef } from "@/content/catalogue";
import { durationMs } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { changeItems, emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

/** Starts a cold after sustained neglect and lets it pass on its own after a day. Runs inside settle. */
export async function settleHealth(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  if (c.condition) {
    const def = CONDITIONS[c.condition as ConditionId];
    const since = c.condition_since ?? now;
    if (def && now.getTime() - since.getTime() >= durationMs(def.naturalMinutes)) {
      await setCondition(tx, c, null, now);
      notices.push("You're feeling better — the cold has passed.");
    }
  } else if (ONSET_NEEDS.some((n) => c.needs[n] <= 0)) {
    await setCondition(tx, c, "run_down", now);
    await emit(tx, c.id, "fell_ill", { condition: "run_down" }, now);
    notices.push("You're run down and caught a cold. Rest, see the nurse at the Borough Health Centre (free) or buy a remedy.");
  }
  return notices;
}

export async function setCondition(tx: Tx, c: CharRow, condition: ConditionId | null, now: Date) {
  await tx.query("UPDATE characters SET condition = $2, condition_since = $3 WHERE id = $1", [c.id, condition, condition ? now : null]);
  c.condition = condition;
  c.condition_since = condition ? now : null;
}

/** Energy decay multiplier from a current condition. */
export const conditionDecay = (c: CharRow) => (c.condition ? CONDITIONS[c.condition as ConditionId]?.energyDecay ?? 1 : 1);

export async function settleDeliveries(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const due = (await tx.query("UPDATE deliveries SET status = 'delivered', delivered_at = $2 WHERE character_id = $1 AND status = 'pending' AND deliver_at <= $2 RETURNING *", [c.id, now])).rows;
  const notices: string[] = [];
  for (const d of due) {
    await changeItems(tx, c.id, d.items as Record<string, number>, 1);
    notices.push(`Your ${DELIVERY_MENU.find((m) => m.id === d.menu_id)?.name ?? "order"} was delivered home.`);
  }
  return notices;
}

export async function orderDelivery(tx: Tx, accountId: string, p: { menuId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const m = DELIVERY_MENU.find((x) => x.id === p.menuId);
  if (!m) throw new GameError("bad_item", "That isn't on the menu.");
  const pending = (await tx.query("SELECT count(*) AS n FROM deliveries WHERE character_id = $1 AND status = 'pending'", [c.id])).rows[0];
  if (Number(pending.n) >= 3) throw new GameError("too_many", "You already have three orders on the way.");
  const total = m.pricePence + DELIVERY.feePence;
  await moveMoney(tx, c, -total, "delivery", `Delivery: ${m.name} (incl. ${fmtMoney(DELIVERY.feePence)} fee)`);
  const at = new Date(now.getTime() + durationMs(DELIVERY.minutes));
  await tx.query("INSERT INTO deliveries (character_id, menu_id, items, total_pence, status, ordered_at, deliver_at) VALUES ($1,$2,$3,$4,'pending',$5,$6)", [c.id, m.id, m.items, total, now, at]);
  return { message: `Ordered ${m.name} for ${fmtMoney(total)}. It'll be at your door in ${DELIVERY.minutes} minutes.` };
}

export async function healthView(tx: Tx, c: CharRow) {
  const def = c.condition ? CONDITIONS[c.condition as ConditionId] : null;
  const orders = (await tx.query("SELECT * FROM deliveries WHERE character_id = $1 ORDER BY ordered_at DESC LIMIT 6", [c.id])).rows.map((d) => ({
    id: String(d.id),
    name: DELIVERY_MENU.find((m) => m.id === d.menu_id)?.name ?? d.menu_id,
    status: d.status as "pending" | "delivered",
    deliverAt: new Date(d.deliver_at).toISOString(),
    totalPence: Number(d.total_pence),
  }));
  return {
    health: def
      ? { id: c.condition!, label: def.label, blurb: def.blurb, since: c.condition_since!.toISOString(), clearsAt: new Date(c.condition_since!.getTime() + durationMs(def.naturalMinutes)).toISOString() }
      : null,
    delivery: {
      feePence: DELIVERY.feePence,
      minutes: DELIVERY.minutes,
      menu: DELIVERY_MENU.map((m) => ({ ...m, contents: Object.entries(m.items).map(([id, q]) => `${q > 1 ? `${q} × ` : ""}${itemDef(id)?.name ?? id}`) })),
      orders,
    },
  };
}
