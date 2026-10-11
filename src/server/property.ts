import {
  INVESTMENT_HOMES,
  PLOTS,
  PROPERTY_RULES,
  PROPERTY_WEEKLY,
  STAGE_NAMES,
  homeValuation,
  investmentDef,
  occupiedWeek,
  plotDef,
  plotValuation,
  saleProceeds,
} from "@/content/property";
import { londonWeekKey } from "@/sim/shift";
import { durationMs, nextLondonWeekly } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const nextIncomeAt = (after: Date) => nextLondonWeekly(after, PROPERTY_WEEKLY.isoWeekday, PROPERTY_WEEKLY.hour);

// ───────────────────────────── settlement ─────────────────────────────

/**
 * Runs in every settlement: finishes construction stages whose time is up (a finished fit-out becomes
 * an investment home), then pays each owned home's weekly rent less upkeep once per income week.
 */
export async function settleProperty(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  notices.push(...(await settleConstruction(tx, c, now)));

  const homes = (await tx.query("SELECT * FROM investment_properties WHERE character_id = $1 AND status = 'owned' AND income_due_at <= $2 ORDER BY bought_at, id FOR UPDATE", [c.id, now])).rows;
  let net = 0;
  let weeks = 0;
  for (const h of homes) {
    const def = investmentDef(h.def_id);
    if (!def) continue;
    let due = new Date(h.income_due_at);
    // After a long absence the letting agent pays at most the last quarter's weeks (an offline cap).
    const earliest = new Date(now.getTime() - PROPERTY_RULES.maxCatchUpWeeks * WEEK_MS);
    if (due < earliest) due = nextIncomeAt(earliest);
    for (let guard = 0; due <= now && guard < PROPERTY_RULES.maxCatchUpWeeks + 2; guard++) {
      const paid = await payWeek(tx, c, h, def, due, now);
      if (paid !== null) {
        net += paid;
        weeks++;
      }
      due = nextIncomeAt(due);
    }
    await tx.query("UPDATE investment_properties SET income_due_at = $2 WHERE id = $1", [h.id, due]);
  }
  if (weeks) notices.push(net >= 0 ? `Rental income: +${fmtMoney(net)} from your investment homes (after upkeep).` : `Your investment homes cost ${fmtMoney(-net)} in upkeep this week (no tenants).`);
  return notices;
}

/** One income week for one home: prorated for a part first week, vacant weeks earn nothing but still pay upkeep. */
async function payWeek(tx: Tx, c: CharRow, h: Record<string, unknown>, def: NonNullable<ReturnType<typeof investmentDef>>, due: Date, now: Date): Promise<number | null> {
  const period = londonWeekKey(due);
  const start = Math.max(new Date(h.bought_at as Date).getTime(), due.getTime() - WEEK_MS);
  const share = Math.min(1, Math.max(0, (due.getTime() - start) / WEEK_MS));
  const occupied = occupiedWeek(String(h.id), period, def);
  const rent = occupied ? Math.floor(def.rentPence * share) : 0;
  const upkeep = Math.floor(def.maintenancePence * share);
  // Upkeep in an empty week comes from your wallet, but never pushes you below zero.
  const net = rent - upkeep >= 0 ? rent - upkeep : -Math.min(upkeep - rent, c.cash_pence);
  const ins = await tx.query(
    `INSERT INTO property_income (property_id, character_id, period_key, occupied, rent_pence, maintenance_pence, net_pence, due_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
    [h.id, c.id, period, occupied, rent, rent - net, net, due, now],
  );
  if (!ins.rowCount) return null;
  await moveMoney(tx, c, net, "property", `${def.name}: ${occupied ? "rent less upkeep" : "upkeep (no tenant)"} for week ${period}`, { type: "property_income", id: `${h.id}:${period}` });
  return net;
}

async function settleConstruction(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const notices: string[] = [];
  const done = (
    await tx.query(
      `UPDATE construction_stages SET status = 'completed', settled_at = $2 WHERE character_id = $1 AND status = 'running' AND ends_at <= $2 RETURNING *`,
      [c.id, now],
    )
  ).rows.sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
  for (const st of done) {
    const plot = (await tx.query("UPDATE land_plots SET stages_done = stages_done + 1 WHERE id = $1 AND stages_done = $2 RETURNING *", [st.plot_id, st.stage])).rows[0];
    if (!plot) continue;
    const def = plotDef(plot.def_id)!;
    if (Number(plot.stages_done) < STAGE_NAMES.length) {
      notices.push(`${STAGE_NAMES[st.stage]} finished at your ${def.name.toLowerCase()}. Start the ${STAGE_NAMES[Number(plot.stages_done)].toLowerCase()} in the Invest app.`);
      continue;
    }
    const home = investmentDef(def.buildsId)!;
    const finishedAt = new Date(st.ends_at);
    const built = await tx.query(
      `INSERT INTO investment_properties (character_id, def_id, source, plot_id, price_paid_pence, bought_at, income_due_at) VALUES ($1,$2,'built',$3,$4,$5,$6) RETURNING id`,
      [c.id, home.id, plot.id, Number(plot.price_paid_pence) + Number(plot.spent_pence), finishedAt, nextIncomeAt(finishedAt)],
    );
    await tx.query("UPDATE land_plots SET status = 'built', building_id = $2, ended_at = $3 WHERE id = $1", [plot.id, built.rows[0].id, finishedAt]);
    await emit(tx, c.id, "building_completed", { plot: def.id, home: home.id }, now);
    notices.push(`Your ${home.name.replace(/ \(self-built\)$/, "").toLowerCase()} is finished! Tenants can move in; rent starts this week.`);
  }
  return notices;
}

// ───────────────────────────── helpers ─────────────────────────────

async function counts(tx: Tx, charId: string) {
  const r = (
    await tx.query(
      `SELECT (SELECT count(*) FROM investment_properties WHERE character_id = $1 AND status = 'owned') AS homes,
              (SELECT count(*) FROM land_plots WHERE character_id = $1 AND status = 'owned') AS plots,
              (SELECT count(*) FROM construction_stages WHERE character_id = $1 AND status = 'running' AND stage = 3) AS fitouts`,
      [charId],
    )
  ).rows[0];
  return { homes: Number(r.homes), plots: Number(r.plots), fitouts: Number(r.fitouts) };
}

function idOf(v: unknown, what: string) {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new GameError("bad_id", `Unknown ${what}.`);
  return v;
}

// ───────────────────────────── investment homes ─────────────────────────────

export async function buyInvestment(tx: Tx, accountId: string, p: { defId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = investmentDef(String(p?.defId));
  if (!def || def.buildOnly) throw new GameError("bad_property", "That property isn't for sale.");
  // The character row is locked, so simultaneous purchases queue here and see each other's counts.
  const n = await counts(tx, c.id);
  if (n.homes + n.fitouts >= PROPERTY_RULES.maxHomes)
    throw new GameError("home_cap", `You can own at most ${PROPERTY_RULES.maxHomes} investment homes${n.fitouts ? " (counting buildings being fitted out)" : ""}. Sell one first.`);
  const price = homeValuation(def, now);
  if (c.cash_pence < price) throw new GameError("insufficient_funds", `${def.name} costs ${fmtMoney(price)}; you have ${fmtMoney(c.cash_pence)}.`);
  const row = await tx.query(
    "INSERT INTO investment_properties (character_id, def_id, source, price_paid_pence, bought_at, income_due_at) VALUES ($1,$2,'bought',$3,$4,$5) RETURNING id",
    [c.id, def.id, price, now, nextIncomeAt(now)],
  );
  await moveMoney(tx, c, -price, "property", `Bought ${def.name}`, { type: "investment", id: row.rows[0].id });
  await emit(tx, c.id, "investment_bought", { def: def.id }, now);
  return { message: `You bought the ${def.name.toLowerCase()} for ${fmtMoney(price)}. Rent (less upkeep) is paid every Saturday at 09:00.` };
}

export async function sellInvestment(tx: Tx, accountId: string, p: { propertyId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  // Settling first pays every finished income week before the property changes hands.
  await settle(tx, c, now);
  const id = idOf(p?.propertyId, "property");
  const row = (await tx.query("UPDATE investment_properties SET status = 'sold', sold_at = $3 WHERE id = $1 AND character_id = $2 AND status = 'owned' RETURNING *", [id, c.id, now])).rows[0];
  if (!row) throw new GameError("not_owned", "You don't own that property (it may already be sold).");
  const def = investmentDef(row.def_id)!;
  const valuation = homeValuation(def, now);
  const proceeds = saleProceeds(valuation);
  await tx.query("UPDATE investment_properties SET sale_pence = $2 WHERE id = $1", [id, proceeds]);
  await moveMoney(tx, c, proceeds, "property", `Sold ${def.name} (valued ${fmtMoney(valuation)}, less ${Math.round(PROPERTY_RULES.saleFee * 100)}% fees)`, { type: "investment", id });
  await emit(tx, c.id, "investment_sold", { def: def.id }, now);
  return { message: `Sold the ${def.name.toLowerCase()} for ${fmtMoney(proceeds)} after fees.` };
}

// ───────────────────────────── land and construction ─────────────────────────────

export async function buyPlot(tx: Tx, accountId: string, p: { defId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const def = plotDef(String(p?.defId));
  if (!def) throw new GameError("bad_plot", "That plot isn't for sale.");
  const n = await counts(tx, c.id);
  if (n.plots >= PROPERTY_RULES.maxPlots) throw new GameError("plot_cap", `You can hold at most ${PROPERTY_RULES.maxPlots} plots of land. Build on or sell one first.`);
  const price = plotValuation(def, now);
  if (c.cash_pence < price) throw new GameError("insufficient_funds", `${def.name} costs ${fmtMoney(price)}; you have ${fmtMoney(c.cash_pence)}.`);
  const row = await tx.query("INSERT INTO land_plots (character_id, def_id, price_paid_pence, bought_at) VALUES ($1,$2,$3,$4) RETURNING id", [c.id, def.id, price, now]);
  await moveMoney(tx, c, -price, "property", `Bought land: ${def.name}`, { type: "plot", id: row.rows[0].id });
  await emit(tx, c.id, "plot_bought", { def: def.id }, now);
  return { message: `The ${def.name.toLowerCase()} is yours for ${fmtMoney(price)}. Start the foundations whenever you're ready.` };
}

async function ownedPlot(tx: Tx, c: CharRow, plotId: unknown) {
  const id = idOf(plotId, "plot");
  const plot = (await tx.query("SELECT * FROM land_plots WHERE id = $1 AND character_id = $2 FOR UPDATE", [id, c.id])).rows[0];
  if (!plot || plot.status === "sold") throw new GameError("not_owned", "You don't own that plot.");
  if (plot.status === "built") throw new GameError("built", "That plot is already built on; manage the home in your investments.");
  const running = (await tx.query("SELECT * FROM construction_stages WHERE plot_id = $1 AND status = 'running'", [id])).rows[0] ?? null;
  return { plot, def: plotDef(plot.def_id)!, running };
}

export async function sellPlot(tx: Tx, accountId: string, p: { plotId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const { plot, def, running } = await ownedPlot(tx, c, p?.plotId);
  if (running || Number(plot.stages_done) > 0) throw new GameError("has_works", "Only bare land can be sold. Finish the building and sell the home instead.");
  const valuation = plotValuation(def, now);
  const proceeds = saleProceeds(valuation);
  const upd = await tx.query("UPDATE land_plots SET status = 'sold', ended_at = $2, sale_pence = $3 WHERE id = $1 AND status = 'owned'", [plot.id, now, proceeds]);
  if (!upd.rowCount) throw new GameError("not_owned", "You don't own that plot.");
  await moveMoney(tx, c, proceeds, "property", `Sold land: ${def.name} (valued ${fmtMoney(valuation)}, less fees)`, { type: "plot", id: plot.id });
  return { message: `Sold the ${def.name.toLowerCase()} for ${fmtMoney(proceeds)} after fees.` };
}

/** Pays for and starts the next stage. Only one stage runs at a time, and each completed stage unlocks the next. */
export async function startConstruction(tx: Tx, accountId: string, p: { plotId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const { plot, def, running } = await ownedPlot(tx, c, p?.plotId);
  if (running) throw new GameError("stage_running", `The ${STAGE_NAMES[running.stage].toLowerCase()} is still under way.`);
  const stage = Number(plot.stages_done);
  if (stage >= STAGE_NAMES.length) throw new GameError("built", "That building is already finished.");
  if (stage === STAGE_NAMES.length - 1) {
    const n = await counts(tx, c.id);
    if (n.homes + n.fitouts >= PROPERTY_RULES.maxHomes)
      throw new GameError("home_cap", `A finished building becomes an investment home, and you can own at most ${PROPERTY_RULES.maxHomes}. Sell one before the fit-out.`);
  }
  const s = def.stages[stage];
  if (c.cash_pence < s.costPence) throw new GameError("insufficient_funds", `The ${STAGE_NAMES[stage].toLowerCase()} costs ${fmtMoney(s.costPence)}; you have ${fmtMoney(c.cash_pence)}.`);
  const endsAt = new Date(now.getTime() + durationMs(s.minutes));
  const ins = await tx.query(
    "INSERT INTO construction_stages (plot_id, character_id, stage, cost_pence, started_at, ends_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [plot.id, c.id, stage, s.costPence, now, endsAt],
  );
  await tx.query("UPDATE land_plots SET spent_pence = spent_pence + $2 WHERE id = $1", [plot.id, s.costPence]);
  await moveMoney(tx, c, -s.costPence, "property", `${STAGE_NAMES[stage]}: ${def.name}`, { type: "construction", id: String(ins.rows[0].id) });
  return { message: `Builders are on site: the ${STAGE_NAMES[stage].toLowerCase()} at your ${def.name.toLowerCase()} will take about ${Math.round(s.minutes / 60)} hours.` };
}

/**
 * Stops the stage under way. Completed stages are kept; the unworked share of the stage's cost
 * (by time remaining) comes back, and the plot stays yours to restart later.
 */
export async function cancelConstruction(tx: Tx, accountId: string, p: { plotId: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const { plot, def, running } = await ownedPlot(tx, c, p?.plotId);
  if (!running) throw new GameError("no_stage", "Nothing is being built there right now.");
  const start = new Date(running.started_at).getTime();
  const end = new Date(running.ends_at).getTime();
  const cost = Number(running.cost_pence);
  const left = end > start ? Math.max(0, Math.min(1, (end - now.getTime()) / (end - start))) : 0;
  const refund = Math.floor(cost * left);
  const upd = await tx.query("UPDATE construction_stages SET status = 'cancelled', settled_at = $2, refund_pence = $3 WHERE id = $1 AND status = 'running'", [running.id, now, refund]);
  if (!upd.rowCount) throw new GameError("no_stage", "Nothing is being built there right now.");
  await tx.query("UPDATE land_plots SET spent_pence = spent_pence - $2 WHERE id = $1", [plot.id, cost]);
  if (refund) await moveMoney(tx, c, refund, "property", `${STAGE_NAMES[running.stage]} stopped: unworked share refunded (${def.name})`, { type: "construction", id: String(running.id) });
  const kept = Number(plot.stages_done);
  return {
    message: `Work stopped. ${refund ? `${fmtMoney(refund)} of the ${STAGE_NAMES[running.stage].toLowerCase()} came back. ` : ""}${kept ? `Your ${kept} finished stage${kept > 1 ? "s are" : " is"} kept.` : "The plot is still yours."}`,
  };
}

// ───────────────────────────── views ─────────────────────────────

/** Investment homes at valuation plus land at valuation and half the building work paid in. Not spendable cash. */
export async function propertyWorth(tx: Tx, charId: string, now: Date) {
  let total = 0;
  for (const h of (await tx.query("SELECT def_id FROM investment_properties WHERE character_id = $1 AND status = 'owned'", [charId])).rows) {
    const def = investmentDef(h.def_id);
    if (def) total += homeValuation(def, now);
  }
  for (const pl of (await tx.query("SELECT def_id, spent_pence FROM land_plots WHERE character_id = $1 AND status = 'owned'", [charId])).rows) {
    const def = plotDef(pl.def_id);
    if (def) total += plotValuation(def, now) + Math.round(Number(pl.spent_pence) / 2);
  }
  return total;
}

export async function propertyView(tx: Tx, c: CharRow, now: Date) {
  const n = await counts(tx, c.id);
  const homes = (await tx.query("SELECT * FROM investment_properties WHERE character_id = $1 AND status = 'owned' ORDER BY bought_at, id", [c.id])).rows;
  const incomeRows = (await tx.query("SELECT * FROM property_income WHERE character_id = $1 ORDER BY id DESC LIMIT 12", [c.id])).rows;
  const totals = (await tx.query("SELECT property_id, COALESCE(SUM(net_pence), 0) AS s FROM property_income WHERE character_id = $1 GROUP BY property_id", [c.id])).rows;
  const plots = (await tx.query("SELECT * FROM land_plots WHERE character_id = $1 AND status = 'owned' ORDER BY bought_at, id", [c.id])).rows;
  const stages = (await tx.query("SELECT * FROM construction_stages WHERE character_id = $1 AND status = 'running'", [c.id])).rows;
  const names = new Map(homes.map((h) => [String(h.id), investmentDef(h.def_id)?.name ?? "Property"]));
  return {
    invest: {
      maxHomes: PROPERTY_RULES.maxHomes,
      maxPlots: PROPERTY_RULES.maxPlots,
      saleFee: PROPERTY_RULES.saleFee,
      nextIncomeAt: nextIncomeAt(now).toISOString(),
      worthPence: await propertyWorth(tx, c.id, now),
      fitouts: n.fitouts,
      homes: homes.map((h) => {
        const def = investmentDef(h.def_id)!;
        const value = homeValuation(def, now);
        const last = incomeRows.find((r) => r.property_id === h.id);
        return {
          id: String(h.id),
          defId: def.id,
          name: def.name,
          district: def.district,
          source: h.source as "bought" | "built",
          pricePaidPence: Number(h.price_paid_pence),
          valuationPence: value,
          salePence: saleProceeds(value),
          rentPence: def.rentPence,
          maintenancePence: def.maintenancePence,
          vacancy: def.vacancy,
          lastWeek: last ? { period: String(last.period_key), occupied: !!last.occupied, netPence: Number(last.net_pence) } : null,
          totalIncomePence: Number(totals.find((t) => t.property_id === h.id)?.s ?? 0),
          nextIncomeAt: new Date(h.income_due_at).toISOString(),
        };
      }),
      income: incomeRows.map((r) => ({
        id: Number(r.id),
        name: names.get(String(r.property_id)) ?? "Sold property",
        period: String(r.period_key),
        occupied: !!r.occupied,
        rentPence: Number(r.rent_pence),
        maintenancePence: Number(r.maintenance_pence),
        netPence: Number(r.net_pence),
      })),
      catalogue: INVESTMENT_HOMES.filter((h) => !h.buildOnly).map((h) => {
        const price = homeValuation(h, now);
        return { id: h.id, name: h.name, district: h.district, blurb: h.blurb, pricePence: price, basePence: h.pricePence, rentPence: h.rentPence, maintenancePence: h.maintenancePence, vacancy: h.vacancy };
      }),
      plots: plots.map((pl) => {
        const def = plotDef(pl.def_id)!;
        const st = stages.find((s) => s.plot_id === pl.id);
        const done = Number(pl.stages_done);
        const builds = investmentDef(def.buildsId)!;
        return {
          id: String(pl.id),
          defId: def.id,
          name: def.name,
          district: def.district,
          title: def.title,
          valuationPence: plotValuation(def, now),
          salePence: saleProceeds(plotValuation(def, now)),
          spentPence: Number(pl.spent_pence),
          stagesDone: done,
          builds: { name: builds.name, rentPence: builds.rentPence, maintenancePence: builds.maintenancePence },
          running: st ? { stage: Number(st.stage), name: STAGE_NAMES[Number(st.stage)], startedAt: new Date(st.started_at).toISOString(), endsAt: new Date(st.ends_at).toISOString(), costPence: Number(st.cost_pence) } : null,
          next: done < STAGE_NAMES.length ? { stage: done, name: STAGE_NAMES[done], costPence: def.stages[done].costPence, minutes: durationMs(def.stages[done].minutes) / 60_000 } : null,
        };
      }),
      plotCatalogue: PLOTS.map((pl) => {
        const builds = investmentDef(pl.buildsId)!;
        return {
          id: pl.id,
          name: pl.name,
          district: pl.district,
          title: pl.title,
          blurb: pl.blurb,
          pricePence: plotValuation(pl, now),
          buildCostPence: pl.stages.reduce((a, s) => a + s.costPence, 0),
          buildMinutes: pl.stages.reduce((a, s) => a + durationMs(s.minutes) / 60_000, 0),
          builds: { name: builds.name, rentPence: builds.rentPence, maintenancePence: builds.maintenancePence },
        };
      }),
      stageNames: [...STAGE_NAMES],
    },
  };
}
