import { HOME_TIERS, MOVE_IN } from "@/content/character";
import { furnitureDef } from "@/content/catalogue";
import { placementError, type Placed } from "@/sim/placement";
import { londonDayKey, nextLondonWeekly } from "@/sim/time";
import { londonWeekKey } from "@/sim/shift";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, loadCtx, moveMoney, requireCharacter, settle, type CharRow } from "./game";

/** Savings: 0.5% a week, credited once per London day on balances of at least £10 (fictional rate). */
export const SAVINGS = { weeklyRate: 0.005, minPence: 1000, maxCatchUpDays: 60 };
export const RENT_DAY = { isoWeekday: 6, hour: 9 };

const prevDay = (day: string, n = 1) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

async function savingsEntry(tx: Tx, c: CharRow, kind: "deposit" | "withdraw" | "interest", amount: number, balanceAfter: number, now: Date, period: string | null = null) {
  await tx.query("INSERT INTO savings_entries (character_id, kind, amount_pence, balance_after, period_key, created_at) VALUES ($1,$2,$3,$4,$5,$6)", [c.id, kind, amount, balanceAfter, period, now]);
}

async function savingsOf(tx: Tx, charId: string) {
  return Number((await tx.query("SELECT savings_pence FROM characters WHERE id = $1", [charId])).rows[0].savings_pence);
}

/**
 * Brings money obligations up to date: schedules rent, bills each due Saturday exactly once
 * (paid from cash, then savings, otherwise left unpaid), and credits daily savings interest.
 */
export async function settleEconomy(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const home = (await tx.query("SELECT * FROM homes WHERE character_id = $1 FOR UPDATE", [c.id])).rows[0];
  if (home) {
    if (!home.rent_due_at) {
      const tier = HOME_TIERS.find((t) => t.id === home.tier_id)!;
      const due = nextLondonWeekly(new Date(Math.max(now.getTime(), new Date(home.created_at).getTime())), RENT_DAY.isoWeekday, RENT_DAY.hour);
      await tx.query("UPDATE homes SET rent_due_at = $2, rent_pence = CASE WHEN rent_pence = 0 THEN $3 ELSE rent_pence END WHERE id = $1", [home.id, due, tier.rentPence]);
      home.rent_due_at = due;
      if (!Number(home.rent_pence)) home.rent_pence = tier.rentPence;
    }
    let due = new Date(home.rent_due_at);
    for (let guard = 0; due <= now && guard < 12; guard++) {
      const rent = Number(home.rent_pence);
      const period = londonWeekKey(due);
      if (!home.owned && rent > 0) {
        const covered = home.rent_free_until && due < new Date(home.rent_free_until);
        const exists = await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND kind = 'rent' AND period_key = $2", [c.id, period]);
        if (!exists.rowCount) {
          let status: "paid" | "covered" | "unpaid" = "unpaid";
          if (covered) status = "covered";
          else if (c.cash_pence >= rent) {
            await moveMoney(tx, c, -rent, "rent", `Rent for week ${period}`, { type: "bill", id: period });
            status = "paid";
          } else {
            const savings = await savingsOf(tx, c.id);
            if (savings >= rent) {
              await tx.query("UPDATE characters SET savings_pence = savings_pence - $2 WHERE id = $1", [c.id, rent]);
              await savingsEntry(tx, c, "withdraw", -rent, savings - rent, now);
              status = "paid";
            }
          }
          await tx.query("INSERT INTO bills (character_id, kind, period_key, description, amount_pence, status, due_at, paid_at) VALUES ($1,'rent',$2,$3,$4,$5,$6,$7)", [
            c.id,
            period,
            `Rent · ${HOME_TIERS.find((t) => t.id === home.tier_id)?.name ?? "home"}`,
            rent,
            status,
            due,
            status === "unpaid" ? null : now,
          ]);
          notices.push(status === "paid" ? `Rent paid: ${fmtMoney(rent)}.` : status === "covered" ? "This week's rent is covered by your starting support." : `Rent of ${fmtMoney(rent)} is unpaid — pay it from the Bank app when you can.`);
        }
      }
      due = nextLondonWeekly(due, RENT_DAY.isoWeekday, RENT_DAY.hour);
    }
    if (due.getTime() !== new Date(home.rent_due_at).getTime()) await tx.query("UPDATE homes SET rent_due_at = $2 WHERE id = $1", [home.id, due]);
  }

  // Savings interest: one credit per full London day since the last credit.
  const row = (await tx.query("SELECT savings_pence, savings_credited_day FROM characters WHERE id = $1", [c.id])).rows[0];
  const today = londonDayKey(now);
  let last = (row.savings_credited_day as string | null) ?? today;
  if (!row.savings_credited_day) await tx.query("UPDATE characters SET savings_credited_day = $2 WHERE id = $1", [c.id, today]);
  let balance = Number(row.savings_pence);
  let credited = 0;
  const days: string[] = [];
  for (let d = today; d > last && days.length < SAVINGS.maxCatchUpDays; d = prevDay(d)) days.unshift(d);
  for (const d of days) {
    if (balance >= SAVINGS.minPence) {
      const interest = Math.floor((balance * SAVINGS.weeklyRate) / 7);
      if (interest > 0) {
        const ins = await tx.query(
          "INSERT INTO savings_entries (character_id, kind, amount_pence, balance_after, period_key, created_at) VALUES ($1,'interest',$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [c.id, interest, balance + interest, d, now],
        );
        if (ins.rowCount) {
          balance += interest;
          credited += interest;
        }
      }
    }
    last = d;
  }
  if (days.length) await tx.query("UPDATE characters SET savings_pence = $2, savings_credited_day = $3 WHERE id = $1", [c.id, balance, today]);
  if (credited) notices.push(`Savings interest: +${fmtMoney(credited)}.`);
  return notices;
}

function amount(p: { amountPence?: unknown }) {
  const n = Number(p.amountPence);
  if (!Number.isInteger(n) || n <= 0) throw new GameError("bad_amount", "Enter an amount in whole pence above zero.");
  return n;
}

export async function depositSavings(tx: Tx, accountId: string, p: { amountPence: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const a = amount(p);
  await moveMoney(tx, c, -a, "savings", "Moved to savings");
  const res = await tx.query("UPDATE characters SET savings_pence = savings_pence + $2 WHERE id = $1 RETURNING savings_pence", [c.id, a]);
  await savingsEntry(tx, c, "deposit", a, Number(res.rows[0].savings_pence), now);
  return { message: `${fmtMoney(a)} moved to savings.` };
}

export async function withdrawSavings(tx: Tx, accountId: string, p: { amountPence: number }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const a = amount(p);
  const res = await tx.query("UPDATE characters SET savings_pence = savings_pence - $2 WHERE id = $1 AND savings_pence >= $2 RETURNING savings_pence", [c.id, a]);
  if (!res.rowCount) throw new GameError("insufficient_savings", "You don't have that much in savings.");
  await savingsEntry(tx, c, "withdraw", -a, Number(res.rows[0].savings_pence), now);
  await moveMoney(tx, c, a, "savings", "Taken from savings");
  return { message: `${fmtMoney(a)} moved to your wallet.` };
}

export async function payBills(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const unpaid = (await tx.query("SELECT * FROM bills WHERE character_id = $1 AND status = 'unpaid' ORDER BY due_at FOR UPDATE", [c.id])).rows;
  if (!unpaid.length) throw new GameError("no_bills", "You have no unpaid bills.");
  let paid = 0;
  for (const b of unpaid) {
    if (c.cash_pence < Number(b.amount_pence)) break;
    await moveMoney(tx, c, -Number(b.amount_pence), "rent", `${b.description} (week ${b.period_key}, late)`, { type: "bill", id: String(b.id) });
    await tx.query("UPDATE bills SET status = 'paid', paid_at = $2 WHERE id = $1", [b.id, now]);
    paid++;
  }
  if (!paid) throw new GameError("insufficient_funds", `The oldest bill is ${fmtMoney(Number(unpaid[0].amount_pence))}; you have ${fmtMoney(c.cash_pence)}.`);
  return { message: `Paid ${paid} bill${paid > 1 ? "s" : ""}.${paid < unpaid.length ? ` ${unpaid.length - paid} still unpaid.` : " All settled."}` };
}

async function hasArrears(tx: Tx, charId: string) {
  return (await tx.query("SELECT 1 FROM bills WHERE character_id = $1 AND status = 'unpaid' LIMIT 1", [charId])).rowCount! > 0;
}

export function moveInCost(tierId: string) {
  const t = HOME_TIERS.find((x) => x.id === tierId)!;
  return { deposit: t.rentPence * MOVE_IN.depositWeeks, fee: t.rentPence * MOVE_IN.feeWeeks };
}

/** Keeps every placed item that still fits (in its original order); the rest go to storage. */
export function refitFurniture(placed: Placed[], gridW: number, gridD: number) {
  const kept: Placed[] = [];
  const stored: Placed[] = [];
  for (const p of placed) {
    if (!placementError(p, kept, gridW, gridD)) kept.push(p);
    else stored.push(p);
  }
  return { kept, stored };
}

export async function moveHome(tx: Tx, accountId: string, p: { tierId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const tier = HOME_TIERS.find((t) => t.id === p.tierId);
  if (!tier) throw new GameError("bad_home", "Unknown home.");
  const ctx = await loadCtx(tx, c, now);
  if (ctx.journey || ctx.running || ctx.shift) throw new GameError("busy", "Finish what you're doing before moving house.");
  if (ctx.home.tier.id === tier.id) throw new GameError("same_home", "You already live here.");
  if (await hasArrears(tx, c.id)) throw new GameError("arrears", "Pay your unpaid rent before moving.");
  const home = ctx.home.home;
  const cost = moveInCost(tier.id);
  const refund = Number(home.deposit_pence);
  if (c.cash_pence + refund < cost.deposit + cost.fee) throw new GameError("insufficient_funds", `Moving in needs ${fmtMoney(cost.deposit + cost.fee)} (deposit ${fmtMoney(cost.deposit)} + fee ${fmtMoney(cost.fee)}).`);
  if (refund) await moveMoney(tx, c, refund, "home", "Deposit returned from your old home");
  await moveMoney(tx, c, -cost.deposit, "home", `Deposit: ${tier.name} (refundable when you move out)`);
  await moveMoney(tx, c, -cost.fee, "home", `Move-in fee: ${tier.name}`);
  const { stored } = refitFurniture(ctx.home.placed, tier.gridW, tier.gridD);
  for (const s of stored) await tx.query("UPDATE furniture SET home_id = NULL, x = NULL, y = NULL WHERE id = $1", [s.id]);
  // An owned home is kept as an asset in a later milestone; for now moving out of it simply ends ownership is not allowed.
  await tx.query(
    "UPDATE homes SET tier_id = $2, district = $3, owned = false, rent_pence = $4, deposit_pence = $5, rent_due_at = $6, rent_free_until = NULL WHERE id = $1",
    [home.id, tier.id, tier.district, tier.rentPence, cost.deposit, nextLondonWeekly(now, RENT_DAY.isoWeekday, RENT_DAY.hour)],
  );
  await emit(tx, c.id, "moved_home", { tier: tier.id }, now);
  const names = stored.map((s) => furnitureDef(s.defId)?.name).filter(Boolean);
  return { message: `Welcome to your ${tier.name.toLowerCase()} in ${tier.district}!${names.length ? ` ${names.length} item${names.length > 1 ? "s" : ""} didn't fit and went to storage.` : ""}` };
}

export async function buyHome(tx: Tx, accountId: string, _p: unknown, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const ctx = await loadCtx(tx, c, now);
  const home = ctx.home.home;
  if (home.owned) throw new GameError("owned", "You already own this home.");
  const tier = ctx.home.tier;
  if (!tier.pricePence) throw new GameError("not_for_sale", `A ${tier.name.toLowerCase()} can't be bought. Move somewhere you can buy first.`);
  if (await hasArrears(tx, c.id)) throw new GameError("arrears", "Pay your unpaid rent first.");
  const deposit = Number(home.deposit_pence);
  if (c.cash_pence + deposit < tier.pricePence) throw new GameError("insufficient_funds", `Buying needs ${fmtMoney(tier.pricePence)}; you have ${fmtMoney(c.cash_pence + deposit)} including your deposit.`);
  if (deposit) await moveMoney(tx, c, deposit, "home", "Deposit returned (you're buying your home)");
  await moveMoney(tx, c, -tier.pricePence, "home", `Bought your ${tier.name.toLowerCase()}`);
  await tx.query("UPDATE homes SET owned = true, deposit_pence = 0 WHERE id = $1", [home.id]);
  await emit(tx, c.id, "home_bought", { tier: tier.id }, now);
  return { message: `The keys are yours! You own your ${tier.name.toLowerCase()} and pay no more rent.` };
}

export async function economyView(tx: Tx, c: CharRow, now: Date) {
  const home = (await tx.query("SELECT * FROM homes WHERE character_id = $1", [c.id])).rows[0];
  const tier = HOME_TIERS.find((t) => t.id === home.tier_id)!;
  const savings = await savingsOf(tx, c.id);
  const bills = (await tx.query("SELECT * FROM bills WHERE character_id = $1 ORDER BY due_at DESC LIMIT 8", [c.id])).rows.map((b) => ({
    id: String(b.id),
    description: String(b.description),
    period: String(b.period_key),
    amountPence: Number(b.amount_pence),
    status: b.status as "paid" | "covered" | "unpaid",
    dueAt: new Date(b.due_at).toISOString(),
  }));
  const unpaid = (await tx.query("SELECT COALESCE(SUM(amount_pence), 0) AS s, count(*) AS n FROM bills WHERE character_id = $1 AND status = 'unpaid'", [c.id])).rows[0];
  const entries = (await tx.query("SELECT * FROM savings_entries WHERE character_id = $1 ORDER BY id DESC LIMIT 10", [c.id])).rows.map((e) => ({
    id: Number(e.id),
    kind: String(e.kind),
    amountPence: Number(e.amount_pence),
    balanceAfter: Number(e.balance_after),
    at: new Date(e.created_at).toISOString(),
  }));
  const furniture = Number((await tx.query("SELECT COALESCE(SUM(price_pence), 0) AS s FROM furniture WHERE character_id = $1", [c.id])).rows[0].s);
  const homeValue = home.owned ? tier.pricePence ?? 0 : Number(home.deposit_pence);
  const arrears = Number(unpaid.s);
  return {
    bank: {
      savingsPence: savings,
      weeklyRate: SAVINGS.weeklyRate,
      minPence: SAVINGS.minPence,
      entries,
      unpaidPence: arrears,
      unpaidCount: Number(unpaid.n),
      bills,
      netWorthPence: c.cash_pence + savings + Math.round(furniture / 2) + homeValue - arrears,
    },
    housing: {
      tierId: tier.id,
      owned: !!home.owned,
      rentPence: home.owned ? 0 : Number(home.rent_pence || tier.rentPence),
      depositPence: Number(home.deposit_pence),
      nextRentAt: home.rent_due_at ? new Date(home.rent_due_at).toISOString() : null,
      rentFreeUntil: home.rent_free_until && new Date(home.rent_free_until) > now ? new Date(home.rent_free_until).toISOString() : null,
      tiers: HOME_TIERS.map((t) => {
        const cost = moveInCost(t.id);
        return { ...t, deposit: cost.deposit, fee: cost.fee, current: t.id === tier.id };
      }),
    },
  };
}
