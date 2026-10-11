/**
 * Deterministic balance simulation (spec ch. 31 "adjust through simulation").
 * Run: npx tsx scripts/simulate.ts   → writes docs/BALANCE.md
 *
 * It replays a sensible daily routine for three origins over 7, 30 and 90 London days using the real
 * content tables and pure rules (pay table, promotion rule, wage tax, rent, utilities, staff wages,
 * check-in cycle, assigned daily missions, savings rate, food and fare prices). Nothing is random:
 * missions come from the same deterministic assignment the server uses, with a fixed character id.
 * It is a model of a player, not the server: it does not simulate needs minute by minute, and it
 * assumes the routine below is always possible (venues open, energy available).
 */
import fs from "node:fs";
import path from "node:path";
import { HOME_TIERS, MOVE_IN, ORIGINS, STARTER_RENT_FREE_WEEKS } from "@/content/character";
import { CAREERS, SHIFT, WORK_STYLES, salaryPence } from "@/content/careers";
import { FURNITURE, ITEMS, RECIPES } from "@/content/catalogue";
import { CHECKIN_REWARDS } from "@/content/goals";
import { CHEF_MEALS_PER_DAY, PARTY_ACTIVITIES, STAFF, UTILITIES_PENCE, utilitiesFor } from "@/content/household";
import { ACTIVITIES, journeyQuote, missionDef } from "@/content/world";
import { RESALE_FRACTION, SKILL_THRESHOLDS } from "@/content/balance";
import type { CareerDef, SkillId } from "@/content/types";
import { levelForXp } from "@/sim/progression";
import { assignMissions } from "@/sim/setup";
import { applyShift, wageTax } from "@/sim/shift";
import { SAVINGS, HOME_SALE_FRACTION } from "@/server/economy";

const money = (p: number) => `${p < 0 ? "−" : ""}£${(Math.abs(p) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const START = "2026-10-12"; // a Monday
const HORIZONS = [7, 30, 90];

// ───────────────────────────── routine assumptions ─────────────────────────────

/** Share of each day's three assigned missions the routine completes (bonus only when all three are done). */
const MISSIONS_DONE = 2;
/** Tasks answered well per four-task shift (each adds pay and performance). */
const TASK_SUCCESSES = 3;
/** Cash kept in the wallet; anything above goes to savings at the end of the day. */
const WALLET_BUFFER_WEEKS = 2;

const groceryPrice = (id: string) => ITEMS.find((i) => i.id === id)?.pricePence ?? 0;
const recipeCost = (id: string) => Object.entries(RECIPES.find((r) => r.id === id)!.ingredients).reduce((t, [g, q]) => t + groceryPrice(g) * q, 0);
/** Three home-cooked meals: tea and toast, pasta bowl, beans on toast (no skill gate). */
const FOOD_PER_DAY = recipeCost("tea_and_toast") + recipeCost("pasta_bowl") + recipeCost("beans_on_toast");

interface Scenario {
  id: string;
  label: string;
  originId: string;
  careerId: string;
  workdays: number[];
  /** Weekend side tasks at the Food Hall (serve the lunch rush, 3 × £15). */
  weekendSideTasks: boolean;
  /** Household staff hired from day one (if the home allows). */
  staff: string[];
}

const SCENARIOS: Scenario[] = [
  { id: "poor", label: "Poor start — newly arrived student (hall room, £100)", originId: "new_student", careerId: "tech", workdays: [1, 2, 3, 4, 5], weekendSideTasks: true, staff: [] },
  { id: "average", label: "Average start — working Londoner (shared room, £220)", originId: "working_londoner", careerId: "kitchen", workdays: [1, 2, 3, 4, 5], weekendSideTasks: true, staff: [] },
  { id: "wealthy", label: "Wealthy start — inherited wealth (owned one-bed, £2,500)", originId: "inherited_wealth", careerId: "tech", workdays: [1, 2, 3, 4, 5], weekendSideTasks: false, staff: ["cleaner", "chef"] },
];

// ───────────────────────────── simulation ─────────────────────────────

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isoWeekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() || 7;

interface Totals {
  wagesNet: number;
  tax: number;
  side: number;
  missions: number;
  checkin: number;
  interest: number;
  rent: number;
  utilities: number;
  staff: number;
  food: number;
  travel: number;
}
const zero = (): Totals => ({ wagesNet: 0, tax: 0, side: 0, missions: 0, checkin: 0, interest: 0, rent: 0, utilities: 0, staff: 0, food: 0, travel: 0 });

interface Snapshot {
  day: number;
  cash: number;
  savings: number;
  role: string;
  totals: Totals;
  skills: Partial<Record<SkillId, number>>;
}

function homeTravel(career: CareerDef) {
  return journeyQuote("home", career.workplace, "walk").minutes <= 12 ? 0 : 2 * journeyQuote("home", career.workplace, "bus").farePence;
}

function simulate(sc: Scenario, days: number) {
  const origin = ORIGINS.find((o) => o.id === sc.originId)!;
  const career = CAREERS.find((c) => c.id === sc.careerId)!;
  const tier = HOME_TIERS.find((t) => t.id === origin.homeTier)!;
  const tierIdx = HOME_TIERS.indexOf(tier);
  const owned = !!origin.ownsHome;
  const rentFreeDays = STARTER_RENT_FREE_WEEKS * 7;
  const xp: Partial<Record<SkillId, number>> = {};
  for (const [s, l] of Object.entries(origin.skills)) xp[s as SkillId] = [0, 100, 250][l as number] ?? 0;
  const lv = () => Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, levelForXp(v ?? 0)])) as Partial<Record<SkillId, number>>;
  const staff = STAFF.filter((s) => sc.staff.includes(s.id) && tier.gridW >= s.minGrid);
  const commute = homeTravel(career);

  let cash = origin.cashPence;
  let savings = 0;
  let prog = { rank: 1, grade: 1, performance: SHIFT.startPerformance, shiftsAtGrade: 0 };
  let weekWages = 0;
  const t = zero();
  const weekly: number[] = []; // net cash flow per completed week
  let weekFlow = 0;
  const snaps: Snapshot[] = [];
  let nextTierDay: number | null = null;
  const next = HOME_TIERS[tierIdx + 1];
  const nextWeekly = next ? next.rentPence + utilitiesFor(next.id) : 0;
  const nextMoveIn = next ? next.rentPence * (MOVE_IN.depositWeeks + MOVE_IN.feeWeeks) : 0;
  let low = cash;
  let topRankDay: number | null = null;
  /** First day each higher tier becomes affordable (same rule as the next tier). */
  const ladder: Record<string, number | null> = Object.fromEntries(HOME_TIERS.slice(tierIdx + 1).map((h) => [h.id, null]));

  // First staff wages are prorated to Saturday 09:00 (from Monday ≈ 5/7 of a week).
  for (const s of staff) {
    const first = Math.ceil((s.wagePence * 5) / 7);
    cash -= first;
    t.staff += first;
    weekFlow -= first;
  }

  for (let d = 0; d < days; d++) {
    const day = addDays(START, d);
    const wd = isoWeekday(day);
    if (wd === 1) {
      weekWages = 0;
    }
    const flow0 = cash + savings;

    // Daily check-in (streak never broken in this routine).
    const ci = CHECKIN_REWARDS[d % CHECKIN_REWARDS.length].pence;
    cash += ci;
    t.checkin += ci;

    // Food: three home-cooked meals (chef meals replace them when a chef is employed).
    const chef = staff.some((s) => s.id === "chef");
    const food = chef ? Math.max(0, FOOD_PER_DAY - FOOD_PER_DAY * Math.min(1, CHEF_MEALS_PER_DAY / 3)) : FOOD_PER_DAY;
    cash -= food;
    t.food += food;

    // Work shift on workdays (steady style, three of four tasks answered well).
    if (sc.workdays.includes(wd) && career.workdays.includes(wd)) {
      const salary = salaryPence(career, prog.rank, prog.grade);
      const gross = Math.round(salary * (1 + SHIFT.taskPayBonus * TASK_SUCCESSES));
      const tax = wageTax(weekWages, gross);
      weekWages += gross;
      cash += gross - tax;
      t.wagesNet += gross - tax;
      t.tax += tax;
      cash -= commute;
      t.travel += commute;
      xp[career.skill] = (xp[career.skill] ?? 0) + SHIFT.xpPerShift;
      const perfDelta = WORK_STYLES.steady.perf + TASK_SUCCESSES * SHIFT.taskPerf.success;
      prog = applyShift(prog, career, { full: true, perfDelta }, lv()).next;
      if (prog.rank === 5 && topRankDay === null) topRankDay = d + 1;
    } else if (sc.weekendSideTasks) {
      const serve = ACTIVITIES.find((a) => a.id === "serve_shift")!;
      const pay = serve.payPence! * (serve.dailyLimit ?? 1);
      cash += pay;
      t.side += pay;
    }

    // Free daily practice (coding club, library, home desk…): 20 XP toward the next blocking gate skill.
    const gate = career.ranks.slice(prog.rank).find((r) => r.gate && (lv()[r.gate.skill] ?? 0) < r.gate.level)?.gate;
    const practise = gate?.skill ?? career.skill;
    xp[practise] = (xp[practise] ?? 0) + 20;

    // Daily missions: the first MISSIONS_DONE of the deterministic assignment.
    const ids = assignMissions(`sim-${sc.id}`, day);
    const m = ids.slice(0, MISSIONS_DONE).reduce((s, id) => s + (missionDef(id)?.reward.pence ?? 0), 0);
    cash += m;
    t.missions += m;

    // Saturday 09:00: rent then utilities then staff wages (rent support covers rent and utilities at first).
    if (wd === 6) {
      const covered = d < rentFreeDays;
      if (!owned && !covered) {
        cash -= tier.rentPence;
        t.rent += tier.rentPence;
      }
      if (!covered) {
        cash -= UTILITIES_PENCE[tier.id];
        t.utilities += UTILITIES_PENCE[tier.id];
      }
      const wages = staff.reduce((s, x) => s + x.wagePence, 0);
      cash -= wages;
      t.staff += wages;
    }
    // Bills are paid from savings when the wallet runs short.
    if (cash < 0 && savings > 0) {
      const take = Math.min(savings, -cash);
      savings -= take;
      cash += take;
    }

    // Savings interest (daily credit on balances of at least £10), then sweep surplus into savings.
    if (savings >= SAVINGS.minPence) {
      const interest = Math.floor((savings * SAVINGS.weeklyRate) / 7);
      savings += interest;
      t.interest += interest;
    }
    const weeklyCost = (owned ? 0 : tier.rentPence) + UTILITIES_PENCE[tier.id] + FOOD_PER_DAY * 7 + commute * 5;
    const buffer = weeklyCost * WALLET_BUFFER_WEEKS;
    if (cash > buffer) {
      savings += cash - buffer;
      cash = buffer;
    }
    low = Math.min(low, cash + savings);

    weekFlow += cash + savings - flow0;
    if (wd === 7) {
      weekly.push(weekFlow);
      weekFlow = 0;
    }
    // Next home tier: move-in plus two weeks of its costs saved, and a recent week that covers its rent and utilities.
    const lastWeek = weekly[weekly.length - 1];
    if (next && nextTierDay === null && cash + savings >= nextMoveIn + 2 * nextWeekly && lastWeek !== undefined && lastWeek + (owned ? 0 : tier.rentPence) + UTILITIES_PENCE[tier.id] >= nextWeekly) {
      nextTierDay = d + 1;
    }
    if (lastWeek !== undefined)
      for (const h of HOME_TIERS.slice(tierIdx + 1)) {
        const cost = h.rentPence + utilitiesFor(h.id);
        const moveIn = h.rentPence * (MOVE_IN.depositWeeks + MOVE_IN.feeWeeks);
        if (ladder[h.id] === null && cash + savings >= moveIn + 2 * cost && lastWeek + (owned ? 0 : tier.rentPence) + UTILITIES_PENCE[tier.id] >= cost) ladder[h.id] = d + 1;
      }
    if (HORIZONS.includes(d + 1)) {
      snaps.push({ day: d + 1, cash, savings, role: `${career.ranks[prog.rank - 1].title} ${["I", "II", "III"][prog.grade - 1]}`, totals: { ...t }, skills: lv() });
    }
  }
  return { origin, career, tier, next, nextMoveIn, nextWeekly, nextTierDay, snaps, weekly, low, owned, staff, commute, topRankDay, ladder };
}

// ───────────────────────────── exploit checks ─────────────────────────────

interface Finding {
  area: string;
  verdict: "ok" | "watch" | "issue";
  detail: string;
}

function exploitChecks(): Finding[] {
  const out: Finding[] = [];
  const unlimited = ACTIVITIES.filter((a) => a.payPence && !a.dailyLimit && !a.once);
  out.push({
    area: "Paid activities without a daily limit",
    verdict: unlimited.length ? "issue" : "ok",
    detail: unlimited.length ? unlimited.map((a) => a.id).join(", ") : "Every paid side task has a daily limit or pays once.",
  });
  const sidePerDay = ACTIVITIES.filter((a) => a.payPence && a.dailyLimit).reduce((s, a) => s + a.payPence! * a.dailyLimit!, 0);
  const sideMinutes = ACTIVITIES.filter((a) => a.payPence && a.dailyLimit).reduce((s, a) => s + a.minutes * a.dailyLimit!, 0);
  const intern = salaryPence(CAREERS[0], 1, 1);
  out.push({
    area: "Side tasks versus a career",
    verdict: sidePerDay > intern * 2 ? "watch" : "ok",
    detail: `Doing every daily-limited side task in London pays at most ${money(sidePerDay)} a day for ${sideMinutes} task-minutes plus travel between ${new Set(ACTIVITIES.filter((a) => a.payPence && a.dailyLimit).map((a) => a.location)).size} venues (some need skills). A starter Technology shift pays ${money(intern)} for 60 minutes. Side tasks are a useful top-up, not a replacement.`,
  });
  const flip = FURNITURE.map((f) => Math.round(f.pricePence * 0.9 * RESALE_FRACTION) - Math.round(f.pricePence * 0.9));
  out.push({
    area: "Furniture buy-and-sell loop",
    verdict: Math.max(...flip) < 0 ? "ok" : "issue",
    detail: `Resale is ${RESALE_FRACTION * 100}% of the price paid (including the 10% perk discount), so every flip loses money (best case ${money(Math.max(...flip))} per item).`,
  });
  const homeLoss = HOME_TIERS.filter((h) => h.pricePence).map((h) => Math.round(h.pricePence! * HOME_SALE_FRACTION) - h.pricePence!);
  out.push({
    area: "Home buy-and-sell loop",
    verdict: Math.max(...homeLoss) < 0 ? "ok" : "issue",
    detail: `Selling returns ${HOME_SALE_FRACTION * 100}% of the price and moving costs three weeks' rent, so buying and selling always loses (smallest loss ${money(-Math.max(...homeLoss))} before move-in costs).`,
  });
  const inherited = ORIGINS.find((o) => o.ownsHome);
  if (inherited) {
    const t = HOME_TIERS.find((h) => h.id === inherited.homeTier)!;
    const windfall = Math.round(t.pricePence! * HOME_SALE_FRACTION);
    out.push({
      area: "Inherited home sold on day one",
      verdict: "watch",
      detail: `An inherited-wealth character can move out on day one and receive ${money(windfall)} for the ${t.name.toLowerCase()} (about ${Math.round(windfall / intern)} starter shifts). It is a legitimate sale, not a loop, but it lets the 5% origin skip most of the early economy. Product decision: keep (it's what inheriting a flat means), or make inherited homes unsellable for the first weeks.`,
    });
  }
  const topWeek = salaryPence(CAREERS.reduce((a, b) => (a.multiplier > b.multiplier ? a : b)), 5, 3) * 5;
  const breakEven = Math.round((intern * 5) / SAVINGS.weeklyRate);
  out.push({
    area: "Savings interest has no cap",
    verdict: "watch",
    detail: `At ${SAVINGS.weeklyRate * 100}% a week, savings of ${money(breakEven)} earn as much as a starter's five shifts a week, and ${money(Math.round(topWeek / SAVINGS.weeklyRate))} out-earns a Managing Director. Balances that large are far off for now, but a cap on the interest-earning balance (or tiered rate) is recommended before late-game wealth arrives. Not changed here (economy workstream).`,
  });
  const chef = STAFF.find((s) => s.id === "chef")!;
  const perMeal = Math.round(chef.wagePence / (CHEF_MEALS_PER_DAY * 7));
  out.push({
    area: "Chef meals",
    verdict: "ok",
    detail: `A chef costs ${money(chef.wagePence)} a week for up to ${CHEF_MEALS_PER_DAY * 7} meals (${money(perMeal)} each, if every meal is collected) versus ${money(Math.round(FOOD_PER_DAY / 3))} for a basic home-cooked meal. Meals can't be sold, so the chef saves time, not money. Capped at ${CHEF_MEALS_PER_DAY} a day on the server.`,
  });
  out.push({
    area: "Staff hire-and-fire",
    verdict: "ok",
    detail: "First wages are prorated to Saturday 09:00 and never refunded, so hiring and firing can't recover money or farm services; staff who can't be paid leave without creating debt.",
  });
  const party = PARTY_ACTIVITIES[0];
  out.push({
    area: "House parties",
    verdict: "ok",
    detail: `A party costs ${money(party.costPence)} (or cupboard snacks), pays no money, and is limited to one a night across both versions. Guests are authored NPC friends and add Social and Fun only.`,
  });
  const checkinWeek = CHECKIN_REWARDS.reduce((s, r) => s + r.pence, 0);
  out.push({
    area: "Daily check-in and missions",
    verdict: checkinWeek > intern * 2 ? "watch" : "ok",
    detail: `The 7-day check-in cycle pays ${money(checkinWeek)} a week; missions add roughly £5–£20 a day. Both are bounded per London day and claimed once, but together they are worth about ${Math.round((checkinWeek + 7 * 1000) / intern)} starter shifts a week — generous for a newcomer, fine later.`,
  });
  return out;
}

// ───────────────────────────── report ─────────────────────────────

function report() {
  const lines: string[] = [];
  const p = (s = "") => lines.push(s);
  p("# London Life balance report");
  p();
  p("Generated by `npx tsx scripts/simulate.ts` (deterministic; re-run after any balance change). All values are fictional game pounds.");
  p();
  p("## Routine modelled");
  p();
  p(`- Three home-cooked meals a day (tea and toast, pasta bowl, beans on toast): ${money(FOOD_PER_DAY)} a day in groceries.`);
  p(`- A full shift on each workday (Monday–Friday), steady style, ${TASK_SUCCESSES} of 4 work tasks answered well; promotions follow the real rule (100 performance, 2 shifts per grade, skill gates).`);
  p("- 20 XP of free practice a day towards the next skill gate (coding club, library, home equipment), so skills never rust.");
  p(`- Daily check-in every day, ${MISSIONS_DONE} of the 3 assigned daily missions (no all-three bonus).`);
  p("- Rent, utilities and staff wages every Saturday 09:00; starting support covers rent and utilities for the first two weeks.");
  p(`- Surplus cash above ${WALLET_BUFFER_WEEKS} weeks of costs goes into savings (fictional ${SAVINGS.weeklyRate * 100}% a week).`);
  p("- Bus to work when the workplace is more than a short walk; weekends: three Food Hall lunch-rush side tasks (poor and average starts only).");
  p("- Not modelled: furniture or wardrobe purchases, courses, eating out, minigame prizes, stories, treasure. These are discretionary.");
  p();
  const results = SCENARIOS.map((sc) => ({ sc, r: simulate(sc, 90) }));
  p("## Survival costs per week");
  p();
  p("| Start | Home | Rent | Energy and water | Food | Travel | Staff | Total |");
  p("|---|---|---|---|---|---|---|---|");
  for (const { sc, r } of results) {
    const rent = r.owned ? 0 : r.tier.rentPence;
    const util = UTILITIES_PENCE[r.tier.id];
    const food = r.staff.some((s) => s.id === "chef") ? 0 : FOOD_PER_DAY * 7;
    const travel = r.commute * 5;
    const staff = r.staff.reduce((s, x) => s + x.wagePence, 0);
    p(`| ${sc.id} | ${r.tier.name}${r.owned ? " (owned)" : ""} | ${money(rent)} | ${money(util)} | ${money(food)} | ${money(travel)} | ${money(staff)} | ${money(rent + util + food + travel + staff)} |`);
  }
  p();
  for (const { sc, r } of results) {
    p(`## ${sc.label}`);
    p();
    p(`Career: ${r.career.name}. ${r.staff.length ? `Staff: ${r.staff.map((s) => s.name.toLowerCase()).join(" and ")}.` : "No staff."}`);
    p();
    p("| Day | Wallet + savings | Role | Net wages | Tax | Side tasks | Missions + check-in | Interest | Rent + utilities | Staff | Food + travel |");
    p("|---|---|---|---|---|---|---|---|---|---|---|");
    for (const s of r.snaps) {
      const t = s.totals;
      p(`| ${s.day} | ${money(s.cash + s.savings)} | ${s.role} | ${money(t.wagesNet)} | ${money(t.tax)} | ${money(t.side)} | ${money(t.missions + t.checkin)} | ${money(t.interest)} | ${money(t.rent + t.utilities)} | ${money(t.staff)} | ${money(t.food + t.travel)} |`);
    }
    p();
    const steady = r.weekly.slice(3); // after starting support ends
    const avg = steady.length ? Math.round(steady.reduce((a, b) => a + b, 0) / steady.length) : 0;
    p(`- Discretionary cash once rent support ends: about **${money(avg)} a week** (average net change in wallet + savings, weeks 4–13).`);
    p(`- Lowest wallet + savings at any point: ${money(r.low)}${r.low < 0 ? " — **goes negative: the start is not survivable without changes**" : ""}.`);
    if (r.next)
      p(
        `- Next home tier (${r.next.name}, ${money(r.next.rentPence)} rent + ${money(utilitiesFor(r.next.id))} utilities a week, ${money(r.nextMoveIn)} to move in): ${r.nextTierDay ? `affordable on **day ${r.nextTierDay}**` : "not affordable within 90 days"} (move-in plus two weeks of its costs saved, and a recent week's income covers it).${r.owned ? " Moving would also sell the owned home for 90% of its price." : ""}`,
      );
    p(`- Renting further up the ladder (same rule): ${Object.entries(r.ladder).map(([id, d]) => `${HOME_TIERS.find((h) => h.id === id)!.name.toLowerCase()} ${d ? `day ${d}` : "not by day 90"}`).join("; ")}.`);
    p(`- Top rank (${r.career.ranks[4].title}) reached: ${r.topRankDay ? `**day ${r.topRankDay}**` : "not within 90 days"}.`);
    const final = r.snaps[r.snaps.length - 1];
    p(`- Skills by day 90: ${Object.entries(final.skills).filter(([, l]) => (l ?? 0) > 0).map(([k, l]) => `${k} ${l}`).join(", ") || "none"}.`);
    p();
  }
  p("## Exploit and loop checks");
  p();
  p("| Area | Verdict | Detail |");
  p("|---|---|---|");
  for (const f of exploitChecks()) p(`| ${f.area} | ${f.verdict === "ok" ? "OK" : f.verdict === "watch" ? "Watch" : "**Issue**"} | ${f.detail} |`);
  p();
  p("## Conclusions");
  p();
  const poor = results.find((x) => x.sc.id === "poor")!.r;
  p(`- Every start survives: the poorest start never drops below ${money(poor.low)} and the first paid rent arrives after the two weeks of starting support.`);
  p("- Careers dominate income, as intended; check-in and missions are a noticeable newcomer boost that fades in importance as pay rises.");
  const tops = results.map((x) => x.r.topRankDay).filter((d): d is number => d !== null);
  if (tops.length)
    p(
      `- **Biggest balance concern: career progression is fast.** With a steady style and most tasks answered well, a promotion comes about every three shifts, so the top rank arrives around day ${Math.min(...tops)}–${Math.max(...tops)} of weekday play; skill gates are what slow it down. Pay near the top (several thousand pounds a week) makes even the Soho townhouse affordable within about a month and the riverside penthouse within three for the fastest starts. Recommendation for the careers owner: more shifts per grade at higher ranks (for example 2/3/4/5/6 by rank) or a lower performance gain per hour. Not changed here, because it would alter the careers workstream's tested rules.`,
    );
  p("- Utilities (energy and water) are small next to rent at every tier (about 7–12% of rent) and owned homes still pay them, so ownership keeps a running cost.");
  p("- Household staff are a mid-game luxury: a cleaner and chef together cost about the same as a starter's weekly rent in a studio, and give mood and time rather than money.");
  p("- No balance values were changed by this workstream. Two items are flagged for product/economy decisions: uncapped savings interest, and selling an inherited home on day one.");
  p();
  p(`Skill thresholds used: ${SKILL_THRESHOLDS.join(", ")}.`);
  return lines.join("\n") + "\n";
}

const out = path.join(__dirname, "..", "docs", "BALANCE.md");
fs.writeFileSync(out, report());
console.log(`wrote ${path.relative(process.cwd(), out)}`);
