import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { pool } from "@/server/db";
import { socialQueryFor } from "@/server/commands";
import { PLOTS, PROPERTY_RULES, STAGE_NAMES, homeValuation, investmentDef, occupiedWeek, plotDef, plotValuation, saleProceeds } from "@/content/property";
import { londonWeekKey } from "@/sim/shift";
import { durationMs, nextLondonWeekly } from "@/sim/time";
import { cmd, key, ledgerMatches, makeAccount, makeCharacter, minutes, resetDb, state } from "./helpers";

// Saturday 10 Oct 2026, 10:00 London — an hour after the weekly 09:00 income time.
const T0 = new Date("2026-10-10T09:00:00Z");
const days = (n: number, base = T0) => new Date(base.getTime() + n * 86_400_000);
const RICH = 0.99; // owns a one-bed flat, so no rent muddles the sums
const WEEK = 7 * 86_400_000;
const nextSat = (after: Date) => nextLondonWeekly(after, 6, 9);

const setCash = (acc: string, p: number) =>
  pool().query(
    `WITH c AS (UPDATE characters SET cash_pence = $2 WHERE account_id = $1 RETURNING id, cash_pence)
     INSERT INTO ledger_entries (character_id, category, description, amount_pence, balance_after)
     SELECT id, 'test', 'test adjustment', $2 - (SELECT COALESCE(SUM(amount_pence),0) FROM ledger_entries WHERE character_id = c.id), cash_pence FROM c`,
    [acc, p],
  );
const charId = async (acc: string) => (await pool().query("SELECT id FROM characters WHERE account_id = $1", [acc])).rows[0].id as string;
const propertyLedger = async (acc: string) =>
  (await pool().query("SELECT * FROM ledger_entries WHERE character_id = $1 AND category = 'property' ORDER BY id", [await charId(acc)])).rows.map((r) => ({ ...r, amount: Number(r.amount_pence) }));
const incomeRows = async (acc: string) => (await pool().query("SELECT * FROM property_income WHERE character_id = $1 ORDER BY due_at", [await charId(acc)])).rows;

async function richPlayer(cash = 100_000_000, at = T0) {
  const acc = await makeAccount();
  await makeCharacter(acc, at, RICH);
  await setCash(acc, cash);
  return acc;
}

/** Buys and returns the new row's id (found by difference, since rows bought together sort by id). */
async function buyHome(acc: string, defId: string, at: Date) {
  const had = new Set((await state(acc, at)).invest.homes.map((h: any) => h.id));
  await cmd(acc, "BuyInvestment", { defId }, at);
  return (await state(acc, at)).invest.homes.find((h: any) => !had.has(h.id)).id as string;
}

async function buyPlot(acc: string, defId: string, at: Date) {
  const had = new Set((await state(acc, at)).invest.plots.map((p: any) => p.id));
  await cmd(acc, "BuyPlot", { defId }, at);
  return (await state(acc, at)).invest.plots.find((p: any) => !had.has(p.id)).id as string;
}

/** Expected net for one income week, mirroring the documented rule. */
function expectedNet(propertyId: string, defId: string, boughtAt: Date, due: Date) {
  const def = investmentDef(defId)!;
  const start = Math.max(boughtAt.getTime(), due.getTime() - WEEK);
  const share = Math.min(1, (due.getTime() - start) / WEEK);
  const occupied = occupiedWeek(propertyId, londonWeekKey(due), def);
  return (occupied ? Math.floor(def.rentPence * share) : 0) - Math.floor(def.maintenancePence * share);
}

beforeAll(async () => {
  await migrate(process.env.DATABASE_URL!);
});
beforeEach(resetDb);
afterAll(async () => {
  await pool().end();
});

describe("M5 · investment homes", () => {
  it("buys at this week's valuation, from a catalogue separate from residential homes", async () => {
    const acc = await richPlayer();
    const s0 = await state(acc, T0);
    const cat = s0.invest.catalogue.find((h: any) => h.id === "inv_camden_studio");
    expect(cat.pricePence).toBe(homeValuation(investmentDef("inv_camden_studio")!, T0));
    expect(s0.invest.catalogue.map((h: any) => h.id)).not.toContain("bld_brixton_terrace");
    const id = await buyHome(acc, "inv_camden_studio", T0);
    const s = await state(acc, T0);
    expect(s0.wallet.cashPence - s.wallet.cashPence).toBe(cat.pricePence);
    expect(s.invest.homes).toHaveLength(1);
    expect(s.invest.homes[0]).toMatchObject({ id, pricePaidPence: cat.pricePence, source: "bought" });
    // Buying an investment home never changes the residence.
    expect(s.housing.tierId).toBe(s0.housing.tierId);
    expect(s.housing.owned).toBe(s0.housing.owned);
    await expect(cmd(acc, "BuyInvestment", { defId: "bld_brixton_terrace" }, T0)).rejects.toThrow(/isn't for sale/);
    await expect(cmd(acc, "BuyInvestment", { defId: "one_bed" }, T0)).rejects.toThrow(/isn't for sale/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("refuses a purchase you can't afford without touching your cash", async () => {
    const acc = await richPlayer(1000);
    await expect(cmd(acc, "BuyInvestment", { defId: "inv_camden_studio" }, T0)).rejects.toThrow(/costs/);
    const s = await state(acc, T0);
    expect(s.wallet.cashPence).toBe(1000);
    expect(s.invest.homes).toHaveLength(0);
  });

  it("caps ownership at five homes, even when six purchases arrive at once", async () => {
    const acc = await richPlayer();
    const results = await Promise.allSettled(Array.from({ length: 7 }, () => cmd(acc, "BuyInvestment", { defId: "inv_camden_studio" }, T0)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(PROPERTY_RULES.maxHomes);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected).toHaveLength(2);
    expect(String(rejected[0].reason)).toMatch(/at most 5/);
    const s = await state(acc, T0);
    expect(s.invest.homes).toHaveLength(5);
    const price = homeValuation(investmentDef("inv_camden_studio")!, T0);
    expect((await propertyLedger(acc)).reduce((a, r) => a + r.amount, 0)).toBe(-5 * price);
    expect(await ledgerMatches(acc)).toBe(true);
    // Selling one frees a slot.
    await cmd(acc, "SellInvestment", { propertyId: s.invest.homes[0].id }, T0);
    await cmd(acc, "BuyInvestment", { defId: "inv_camden_studio" }, T0);
    expect((await state(acc, T0)).invest.homes).toHaveLength(5);
  });

  it("pays each week's rent less upkeep exactly once, prorating the first part week", async () => {
    const acc = await richPlayer();
    const id = await buyHome(acc, "inv_brixton_flat", T0);
    const due1 = nextSat(T0);
    expect(due1.getTime()).toBeGreaterThan(T0.getTime());
    // Nothing before the first Saturday.
    await state(acc, minutes(due1, -1));
    expect(await incomeRows(acc)).toHaveLength(0);

    // Many loads (and a replayed command) after the due time still pay once.
    for (let i = 0; i < 3; i++) await state(acc, minutes(due1, 1 + i));
    const k = key();
    await cmd(acc, "BuyPlot", { defId: "plot_brixton_yard" }, minutes(due1, 5), k);
    await cmd(acc, "BuyPlot", { defId: "plot_brixton_yard" }, minutes(due1, 6), k);
    let rows = await incomeRows(acc);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].net_pence)).toBe(expectedNet(id, "inv_brixton_flat", T0, due1));
    expect(rows[0].period_key).toBe(londonWeekKey(due1));

    // Two more full weeks.
    const due2 = nextSat(due1);
    const due3 = nextSat(due2);
    await state(acc, minutes(due3, 10));
    await state(acc, minutes(due3, 20));
    rows = await incomeRows(acc);
    expect(rows.map((r) => r.period_key)).toEqual([due1, due2, due3].map(londonWeekKey));
    const expected = [due1, due2, due3].map((d) => expectedNet(id, "inv_brixton_flat", T0, d));
    expect(rows.map((r) => Number(r.net_pence))).toEqual(expected);
    const def = investmentDef("inv_brixton_flat")!;
    for (const r of rows.slice(1)) expect(Number(r.rent_pence)).toBe(r.occupied ? def.rentPence : 0);
    const incomeLedger = (await propertyLedger(acc)).filter((r) => r.ref_type === "property_income");
    expect(incomeLedger.reduce((a, r) => a + r.amount, 0)).toBe(expected.reduce((a, b) => a + b, 0));
    expect(new Set(incomeLedger.map((r) => r.ref_id)).size).toBe(incomeLedger.length);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("has seeded vacancies, and upkeep in an empty week never pushes cash below zero", async () => {
    const acc = await richPlayer();
    const id = await buyHome(acc, "inv_shoreditch_loft", T0);
    const def = investmentDef("inv_shoreditch_loft")!;
    let due = nextSat(T0);
    let vacant: Date | null = null;
    for (let i = 0; i < 200 && !vacant; i++) {
      due = nextSat(due);
      if (!occupiedWeek(id, londonWeekKey(due), def)) vacant = due;
    }
    expect(vacant).not.toBeNull();
    // Bring everything up to just before the vacant week (at most 13 weeks are caught up), then empty the wallet.
    const before = minutes(vacant!, -1);
    await pool().query("UPDATE investment_properties SET income_due_at = $2 WHERE id = $1", [id, vacant]);
    await state(acc, before);
    await setCash(acc, 1000);
    await state(acc, minutes(vacant!, 1));
    const row = (await incomeRows(acc)).find((r) => r.period_key === londonWeekKey(vacant!))!;
    expect(row.occupied).toBe(false);
    expect(Number(row.rent_pence)).toBe(0);
    expect(Number(row.net_pence)).toBe(-1000);
    expect(Number(row.maintenance_pence)).toBe(1000);
    expect(Number(row.maintenance_pence)).toBeLessThan(def.maintenancePence);
    const s = await state(acc, minutes(vacant!, 2));
    expect(s.wallet.cashPence).toBe(0);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("pays at most a quarter's weeks after a long absence", async () => {
    const acc = await richPlayer();
    await buyHome(acc, "inv_camden_studio", T0);
    await state(acc, days(30 * 7));
    const rows = await incomeRows(acc);
    expect(rows.length).toBeLessThanOrEqual(PROPERTY_RULES.maxCatchUpWeeks);
    expect(rows.length).toBeGreaterThanOrEqual(PROPERTY_RULES.maxCatchUpWeeks - 1);
    expect(new Set(rows.map((r) => r.period_key)).size).toBe(rows.length);
    // The schedule is now in the future: loading again pays nothing new.
    await state(acc, days(30 * 7, minutes(T0, 5)));
    expect(await incomeRows(acc)).toHaveLength(rows.length);
  });

  it("sells at valuation less fees, exactly once when two sales race", async () => {
    const acc = await richPlayer();
    const id = await buyHome(acc, "inv_greenwich_house", T0);
    const at = days(3);
    const before = (await state(acc, at)).wallet.cashPence;
    const results = await Promise.allSettled([
      cmd(acc, "SellInvestment", { propertyId: id }, at),
      cmd(acc, "SellInvestment", { propertyId: id }, at),
      cmd(acc, "SellInvestment", { propertyId: id }, at),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const s = await state(acc, at);
    const proceeds = saleProceeds(homeValuation(investmentDef("inv_greenwich_house")!, at));
    expect(s.wallet.cashPence - before).toBe(proceeds);
    expect(s.invest.homes).toHaveLength(0);
    const sales = (await propertyLedger(acc)).filter((r) => r.amount > 0 && r.ref_type === "investment");
    expect(sales).toHaveLength(1);
    expect(await ledgerMatches(acc)).toBe(true);
    // A sold home earns nothing afterwards.
    await state(acc, days(20));
    expect(await incomeRows(acc)).toHaveLength(0);
  });

  it("never lets another player sell your property", async () => {
    const ada = await richPlayer();
    const ben = await richPlayer();
    const id = await buyHome(ada, "inv_camden_studio", T0);
    await expect(cmd(ben, "SellInvestment", { propertyId: id }, T0)).rejects.toThrow(/don't own/);
    await expect(cmd(ben, "SellInvestment", { propertyId: "not-a-uuid" }, T0)).rejects.toThrow(/Unknown property/);
    expect((await state(ada, T0)).invest.homes).toHaveLength(1);
    expect((await state(ben, T0)).invest.homes).toHaveLength(0);
  });
});

describe("M5 · land and construction", () => {
  it("caps bare plots at twenty under simultaneous purchases", async () => {
    const acc = await richPlayer(1_000_000_000);
    for (let i = 0; i < 18; i++) await cmd(acc, "BuyPlot", { defId: "plot_brixton_yard" }, T0);
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => cmd(acc, "BuyPlot", { defId: "plot_brixton_yard" }, T0)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const s = await state(acc, T0);
    expect(s.invest.plots).toHaveLength(PROPERTY_RULES.maxPlots);
    await expect(cmd(acc, "BuyPlot", { defId: "plot_kingscross_mews" }, T0)).rejects.toThrow(/at most 20 plots/);
    const price = plotValuation(plotDef("plot_brixton_yard")!, T0);
    expect((await propertyLedger(acc)).reduce((a, r) => a + r.amount, 0)).toBe(-20 * price);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("builds in timed stages, one at a time, into an investment home that earns rent", async () => {
    const acc = await richPlayer();
    const def = PLOTS.find((p) => p.id === "plot_brixton_yard")!;
    const plotId = await buyPlot(acc, def.id, T0);
    let t = T0;
    for (let stage = 0; stage < 4; stage++) {
      const before = (await state(acc, t)).wallet.cashPence;
      // Two submissions at once start only one stage.
      const res = await Promise.allSettled([cmd(acc, "StartConstruction", { plotId }, t), cmd(acc, "StartConstruction", { plotId }, t)]);
      expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      let s = await state(acc, t);
      const plot = s.invest.plots.find((p: any) => p.id === plotId);
      expect(plot.running).toMatchObject({ stage, name: STAGE_NAMES[stage], costPence: def.stages[stage].costPence });
      expect(before - s.wallet.cashPence).toBe(def.stages[stage].costPence);
      const ends = new Date(plot.running.endsAt);
      expect(ends.getTime() - t.getTime()).toBe(durationMs(def.stages[stage].minutes));
      // Still under way a minute before it ends; the next stage can't start yet.
      s = await state(acc, minutes(ends, -1));
      expect(s.invest.plots.find((p: any) => p.id === plotId).stagesDone).toBe(stage);
      await expect(cmd(acc, "StartConstruction", { plotId }, minutes(ends, -1))).rejects.toThrow(/still under way/);
      t = minutes(ends, 1);
      s = await state(acc, t);
      if (stage < 3) {
        const p = s.invest.plots.find((x: any) => x.id === plotId);
        expect(p.stagesDone).toBe(stage + 1);
        expect(p.running).toBeNull();
        expect(p.spentPence).toBe(def.stages.slice(0, stage + 1).reduce((a, x) => a + x.costPence, 0));
      }
    }
    const s = await state(acc, t);
    expect(s.invest.plots).toHaveLength(0);
    const home = s.invest.homes.find((h: any) => h.defId === def.buildsId);
    expect(home).toBeTruthy();
    expect(home.source).toBe("built");
    const total = def.stages.reduce((a, x) => a + x.costPence, 0);
    expect(home.pricePaidPence).toBe(plotValuation(def, T0) + total);
    await expect(cmd(acc, "StartConstruction", { plotId }, t)).rejects.toThrow(/already built/);
    // The finished building earns from the next Saturday.
    await state(acc, minutes(nextSat(t), 1));
    const rows = await incomeRows(acc);
    expect(rows).toHaveLength(1);
    expect(rows[0].property_id).toBe(home.id);
    const spent = (await propertyLedger(acc)).filter((r) => r.ref_type === "construction").reduce((a, r) => a + r.amount, 0);
    expect(spent).toBe(-total);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("cancelling keeps finished stages and the plot, and refunds only the unworked share", async () => {
    const acc = await richPlayer();
    const def = plotDef("plot_kingscross_mews")!;
    const plotId = await buyPlot(acc, def.id, T0);
    await cmd(acc, "StartConstruction", { plotId }, T0);
    let t = minutes(T0, durationMs(def.stages[0].minutes) / 60_000 + 1);
    await state(acc, t);
    await cmd(acc, "StartConstruction", { plotId }, t);
    const half = new Date(t.getTime() + durationMs(def.stages[1].minutes) / 2);
    const before = (await state(acc, half)).wallet.cashPence;
    await cmd(acc, "CancelConstruction", { plotId }, half);
    let s = await state(acc, half);
    expect(s.wallet.cashPence - before).toBe(Math.floor(def.stages[1].costPence / 2));
    const plot = s.invest.plots.find((p: any) => p.id === plotId);
    expect(plot).toMatchObject({ stagesDone: 1, running: null, spentPence: def.stages[0].costPence });
    expect(plot.next).toMatchObject({ stage: 1, name: "Frame" });
    await expect(cmd(acc, "CancelConstruction", { plotId }, half)).rejects.toThrow(/Nothing is being built/);
    // Long after, no stage completes on its own and nothing more is charged.
    t = days(10);
    s = await state(acc, t);
    expect(s.invest.plots.find((p: any) => p.id === plotId).stagesDone).toBe(1);
    // Restarting picks up at the frame, at full price.
    const c0 = s.wallet.cashPence;
    await cmd(acc, "StartConstruction", { plotId }, t);
    expect(c0 - (await state(acc, t)).wallet.cashPence).toBe(def.stages[1].costPence);
    // Land with works on it can't be sold as bare land.
    await expect(cmd(acc, "SellPlot", { plotId }, t)).rejects.toThrow(/Only bare land/);
    expect(await ledgerMatches(acc)).toBe(true);
  });

  it("won't start a fit-out that would take you past five homes", async () => {
    const acc = await richPlayer(1_000_000_000);
    for (let i = 0; i < 4; i++) await cmd(acc, "BuyInvestment", { defId: "inv_camden_studio" }, T0);
    const a = await buyPlot(acc, "plot_brixton_yard", T0);
    const b = await buyPlot(acc, "plot_brixton_yard", T0);
    // Fast-forward both plots to the fit-out (test setup only).
    await pool().query("UPDATE land_plots SET stages_done = 3 WHERE id = ANY($1)", [[a, b]]);
    await cmd(acc, "StartConstruction", { plotId: a }, T0);
    await expect(cmd(acc, "StartConstruction", { plotId: b }, T0)).rejects.toThrow(/at most 5/);
    // The fit-out in progress holds the fifth slot against purchases too.
    await expect(cmd(acc, "BuyInvestment", { defId: "inv_camden_studio" }, T0)).rejects.toThrow(/at most 5/);
  });

  it("sells bare land at valuation less fees, and keeps other players out", async () => {
    const ada = await richPlayer();
    const ben = await richPlayer();
    const plotId = await buyPlot(ada, "plot_greenwich_garden", T0);
    await expect(cmd(ben, "StartConstruction", { plotId }, T0)).rejects.toThrow(/don't own/);
    await expect(cmd(ben, "SellPlot", { plotId }, T0)).rejects.toThrow(/don't own/);
    await cmd(ada, "StartConstruction", { plotId }, T0);
    await expect(cmd(ben, "CancelConstruction", { plotId }, T0)).rejects.toThrow(/don't own/);
    await cmd(ada, "CancelConstruction", { plotId }, T0);
    const at = days(2);
    const before = (await state(ada, at)).wallet.cashPence;
    await cmd(ada, "SellPlot", { plotId }, at);
    const s = await state(ada, at);
    expect(s.wallet.cashPence - before).toBe(saleProceeds(plotValuation(plotDef("plot_greenwich_garden")!, at)));
    expect(s.invest.plots).toHaveLength(0);
    await expect(cmd(ada, "SellPlot", { plotId }, at)).rejects.toThrow(/don't own/);
    expect(await ledgerMatches(ada)).toBe(true);
  });
});

describe("M5 · property in net worth", () => {
  it("adds homes and land at valuation to the Bank's net worth, and rankings and profiles agree", async () => {
    const ada = await richPlayer();
    const ben = await richPlayer();
    const before = (await state(ada, T0)).bank.netWorthPence;
    const homeId = await buyHome(ada, "inv_brixton_flat", T0);
    const plotId = await buyPlot(ada, "plot_brixton_yard", T0);
    await cmd(ada, "StartConstruction", { plotId }, T0);
    const s = await state(ada, T0);
    const home = homeValuation(investmentDef("inv_brixton_flat")!, T0);
    const land = plotValuation(plotDef("plot_brixton_yard")!, T0);
    const works = plotDef("plot_brixton_yard")!.stages[0].costPence;
    expect(s.bank.propertyPence).toBe(home + land + Math.round(works / 2));
    expect(s.invest.worthPence).toBe(s.bank.propertyPence);
    // Cash went down by the prices paid; net worth only by the half of building work not counted.
    expect(s.bank.netWorthPence).toBe(before - Math.round(works / 2));
    const r = (await socialQueryFor(ada, "rankings", {}, T0)) as any;
    expect(r.rankings.netWorth.you.value).toBe(s.bank.netWorthPence);
    const prof = (await socialQueryFor(ben, "profile", { id: s.character.id }, T0)) as any;
    expect(prof.profile.netWorthPence).toBe(s.bank.netWorthPence);
    // Weeks later the valuations have drifted; all three still agree.
    const later = days(60);
    const s2 = await state(ada, later);
    expect(s2.bank.propertyPence).toBe(homeValuation(investmentDef("inv_brixton_flat")!, later) + plotValuation(plotDef("plot_brixton_yard")!, later) + Math.round(works / 2));
    const r2 = (await socialQueryFor(ada, "rankings", {}, later)) as any;
    expect(r2.rankings.netWorth.you.value).toBe(s2.bank.netWorthPence);
    // Selling turns valuation into cash less fees.
    const w = s2.bank.netWorthPence;
    await cmd(ada, "SellInvestment", { propertyId: homeId }, later);
    const s3 = await state(ada, later);
    const v = homeValuation(investmentDef("inv_brixton_flat")!, later);
    expect(s3.bank.netWorthPence).toBe(w - (v - saleProceeds(v)));
  });
});
