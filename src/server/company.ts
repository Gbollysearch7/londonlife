import { COMPANY, COMPANY_LEVELS, COMPANY_MAX_LEVEL, SECTORS, businessTax, companyDay, companyForecast, companyLevelFor, dayProgress, marketRoll, sectorDef, validCompanyName } from "@/content/market";
import { levelForXp } from "@/sim/progression";
import { londonWeekKey } from "@/sim/shift";
import { londonDayKey, londonInstant } from "@/sim/time";
import { GameError, type Tx } from "./db";
import { effectiveLevel } from "./skills";
import { emit, fmtMoney, moveMoney, requireCharacter, settle, type CharRow } from "./game";

const nextDay = (day: string, n = 1) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The settlement period (London day of the 18:00 close) that an instant counts towards. */
export function companyPeriodFor(at: Date) {
  const day = londonDayKey(at);
  return at.getTime() < londonInstant(day, COMPANY.settleHour).getTime() ? day : nextDay(day);
}

/** The London day of the most recent 18:00 close at or before `at`. */
function lastClosedPeriod(at: Date) {
  const day = londonDayKey(at);
  return at.getTime() >= londonInstant(day, COMPANY.settleHour).getTime() ? day : nextDay(day, -1);
}

/** Enterprise as used for gating: the effective level after skill rust, like every other gate. */
async function enterpriseLevel(tx: Tx, charId: string, now: Date) {
  return effectiveLevel(tx, charId, "enterprise", now);
}

export async function hasCompany(tx: Tx, charId: string) {
  return (await tx.query("SELECT 1 FROM companies WHERE character_id = $1", [charId])).rowCount! > 0;
}

export async function companyLevel(tx: Tx, charId: string) {
  return Number((await tx.query("SELECT level FROM companies WHERE character_id = $1", [charId])).rows[0]?.level ?? 0);
}

export async function foundCompany(tx: Tx, accountId: string, p: { name: string; sector: string }, now: Date) {
  const c = await requireCharacter(tx, accountId);
  await settle(tx, c, now);
  const name = validCompanyName(p.name);
  if (!name) throw new GameError("bad_name", "Use 3–28 letters, numbers or spaces for your company name.");
  const sector = sectorDef(p.sector);
  if (!sector) throw new GameError("bad_sector", "Choose a sector.");
  if (await hasCompany(tx, c.id)) throw new GameError("has_company", "You already run a company. One per person.");
  const e = await enterpriseLevel(tx, c.id, now);
  if (e < COMPANY.minEnterprise) throw new GameError("needs_enterprise", `Founding a company needs Enterprise level ${COMPANY.minEnterprise}; you're level ${e}.`);
  const ins = await tx.query(
    `INSERT INTO companies (character_id, name, sector, settled_through, founded_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (character_id) DO NOTHING RETURNING id`,
    [c.id, name, sector.id, lastClosedPeriod(now), now],
  );
  if (!ins.rowCount) throw new GameError("has_company", "You already run a company. One per person.");
  await moveMoney(tx, c, -COMPANY.foundingPence, "business", `Founded ${name} (registration and setup)`, { type: "company", id: ins.rows[0].id });
  await emit(tx, c.id, "company_founded", { sector: sector.id }, now);
  return { message: `${name} is open for business! Work on it at East Yard Workspace or your home desk; takings settle every day at 18:00.` };
}

/** Called when a "Work on your company" activity completes: logs the session for its settlement period. */
export async function companyWorked(tx: Tx, c: CharRow, activityId: string, finishedAt: Date): Promise<string[]> {
  const co = (await tx.query("SELECT * FROM companies WHERE character_id = $1 FOR UPDATE", [c.id])).rows[0];
  if (!co) return [];
  const period = companyPeriodFor(finishedAt);
  const done = Number((await tx.query("SELECT count(*) AS n FROM company_work WHERE company_id = $1 AND period_key = $2", [co.id, period])).rows[0].n);
  const progress = done < COMPANY.progressSessionsPerDay ? COMPANY.progressPerSession : 0;
  const ins = await tx.query("INSERT INTO company_work (activity_id, company_id, period_key, progress, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [
    activityId,
    co.id,
    period,
    progress,
    finishedAt,
  ]);
  if (!ins.rowCount) return [];
  const parts = [`${done + 1 <= COMPANY.sessionsCounted ? `session ${done + 1} of ${COMPANY.sessionsCounted} counted towards today's takings` : "today's takings already have full credit"}`];
  if (progress) parts.push(...(await addProgress(tx, c, co, progress, finishedAt)));
  return parts;
}

async function addProgress(tx: Tx, c: CharRow, co: Record<string, any>, points: number, now: Date) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const progress = Number(co.progress) + points;
  const level = companyLevelFor(progress);
  await tx.query("UPDATE companies SET progress = $2, level = GREATEST(level, $3) WHERE id = $1", [co.id, progress, level]);
  const out: string[] = [];
  if (level > Number(co.level)) {
    await emit(tx, c.id, "company_levelled", { level: String(level) }, now);
    out.push(`${co.name} reached level ${level}!`);
  }
  co.progress = progress;
  co.level = Math.max(Number(co.level), level);
  return out;
}

/**
 * Settles every 18:00 close since the last one, once each (unique period key), using the founder's
 * enterprise level, that period's work sessions and a seeded market roll. Profit first pays off any
 * carried loss, then business tax (weekly, marginal), and the rest goes to the founder's wallet.
 */
export async function settleCompany(tx: Tx, c: CharRow, now: Date): Promise<string[]> {
  const co = (await tx.query("SELECT * FROM companies WHERE character_id = $1 FOR UPDATE", [c.id])).rows[0];
  if (!co) return [];
  const target = lastClosedPeriod(now);
  if (co.settled_through >= target) return [];
  let start = nextDay(co.settled_through);
  // Away for a long time: only the latest days are traded; the rest pass quietly.
  const earliest = nextDay(target, -(COMPANY.maxCatchUpDays - 1));
  if (start < earliest) start = earliest;
  const sector = sectorDef(co.sector)!;
  const enterprise = await enterpriseLevel(tx, c.id, now);
  const notices: string[] = [];
  for (let d = start; d <= target; d = nextDay(d)) {
    const at = londonInstant(d, COMPANY.settleHour);
    const sessions = Number((await tx.query("SELECT count(*) AS n FROM company_work WHERE company_id = $1 AND period_key = $2", [co.id, d])).rows[0].n);
    const roll = marketRoll(sector, `${co.id}:${d}`);
    const level = Number(co.level);
    const day = companyDay({ sector, level, enterprise, sessions, roll });
    const carried = Number(co.loss_carried_pence);
    let offset = 0;
    let taxable = 0;
    let lossAfter = carried;
    if (day.profit > 0) {
      offset = Math.min(carried, day.profit);
      taxable = day.profit - offset;
      lossAfter = carried - offset;
    } else lossAfter = carried - day.profit;
    const week = londonWeekKey(at);
    const before = Number(
      (await tx.query("SELECT COALESCE(SUM(taxable_pence), 0) AS s FROM company_settlements WHERE company_id = $1 AND week_key = $2", [co.id, week])).rows[0].s,
    );
    const tax = businessTax(before, taxable);
    const paid = taxable - tax;
    const ins = await tx.query(
      `INSERT INTO company_settlements (company_id, period_key, week_key, sessions, roll, takings_pence, costs_pence, profit_pence, offset_pence, taxable_pence, tax_pence, paid_pence, level_after, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
      [co.id, d, week, sessions, roll, day.takings, day.costs, day.profit, offset, taxable, tax, paid, level, now],
    );
    if (!ins.rowCount) continue;
    await tx.query("UPDATE companies SET loss_carried_pence = $2 WHERE id = $1", [co.id, lossAfter]);
    co.loss_carried_pence = lossAfter;
    if (paid > 0) {
      await moveMoney(tx, c, paid, "business", `${co.name} profit for ${d}: ${fmtMoney(taxable)} taxable, ${fmtMoney(tax)} business tax`, { type: "company_day", id: `${co.id}:${d}` });
    }
    const levelUps = await addProgress(tx, c, co, dayProgress(day.profit), now);
    await tx.query("UPDATE company_settlements SET level_after = $3 WHERE company_id = $1 AND period_key = $2", [co.id, d, Number(co.level)]);
    await emit(tx, c.id, "company_settled", { profit: day.profit > 0 ? "yes" : "no" }, now);
    notices.push(
      day.profit > 0
        ? `${co.name} made ${fmtMoney(day.profit)} profit on ${d}${offset ? ` (${fmtMoney(offset)} covered earlier losses)` : ""}; ${fmtMoney(paid)} paid to you after ${fmtMoney(tax)} business tax.`
        : `${co.name} had a slow day on ${d}: a loss of ${fmtMoney(-day.profit)}, carried forward against future profit.`,
      ...levelUps,
    );
  }
  await tx.query("UPDATE companies SET settled_through = $2 WHERE id = $1", [co.id, target]);
  return notices.slice(-6);
}

export async function companyView(tx: Tx, c: CharRow, now: Date) {
  const enterprise = await enterpriseLevel(tx, c.id, now);
  const co = (await tx.query("SELECT * FROM companies WHERE character_id = $1", [c.id])).rows[0];
  const base = {
    minEnterprise: COMPANY.minEnterprise,
    foundingPence: COMPANY.foundingPence,
    enterprise,
    canFound: !co && enterprise >= COMPANY.minEnterprise && c.cash_pence >= COMPANY.foundingPence,
    sectors: SECTORS.map((s) => ({ ...s, forecast: companyForecast(s, 1, enterprise) })),
  };
  if (!co) return { company: { ...base, mine: null } };
  const sector = sectorDef(co.sector)!;
  const level = Number(co.level);
  const period = companyPeriodFor(now);
  const sessions = Number((await tx.query("SELECT count(*) AS n FROM company_work WHERE company_id = $1 AND period_key = $2", [co.id, period])).rows[0].n);
  const reports = (await tx.query("SELECT * FROM company_settlements WHERE company_id = $1 ORDER BY period_key DESC LIMIT 7", [co.id])).rows.map((r) => ({
    period: String(r.period_key),
    sessions: Number(r.sessions),
    roll: Number(r.roll),
    takingsPence: Number(r.takings_pence),
    costsPence: Number(r.costs_pence),
    profitPence: Number(r.profit_pence),
    offsetPence: Number(r.offset_pence),
    taxPence: Number(r.tax_pence),
    paidPence: Number(r.paid_pence),
  }));
  const week = londonWeekKey(londonInstant(period, COMPANY.settleHour));
  const totals = (await tx.query("SELECT COALESCE(SUM(paid_pence),0) AS paid, COALESCE(SUM(tax_pence),0) AS tax, COALESCE(SUM(taxable_pence),0) AS taxable FROM company_settlements WHERE company_id = $1 AND week_key = $2", [co.id, week])).rows[0];
  return {
    company: {
      ...base,
      mine: {
        id: String(co.id),
        name: String(co.name),
        sector: { id: sector.id, name: sector.name, blurb: sector.blurb },
        level,
        maxLevel: COMPANY_MAX_LEVEL,
        progress: Number(co.progress),
        levelFrom: COMPANY_LEVELS[level - 1],
        levelTo: COMPANY_LEVELS[level] ?? null,
        lossCarriedPence: Number(co.loss_carried_pence),
        foundedAt: new Date(co.founded_at).toISOString(),
        nextSettleAt: londonInstant(period, COMPANY.settleHour).toISOString(),
        sessionsToday: sessions,
        sessionsCounted: COMPANY.sessionsCounted,
        forecast: companyForecast(sector, level, enterprise),
        week: { paidPence: Number(totals.paid), taxPence: Number(totals.tax), taxablePence: Number(totals.taxable) },
        reports,
      },
    },
  };
}
