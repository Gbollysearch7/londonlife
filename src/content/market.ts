/**
 * Shared economy content (spec ch. 16, 18): player marketplace, player companies and the player jobs board.
 * Every number here is a fictional DESIGN DEFAULT, not real tax law or business advice.
 */
import type { ActivityDef } from "./types";

// ───────────────────────────── marketplace ─────────────────────────────

export const MARKET = {
  /** Fictional market fee taken from the seller's proceeds when an item sells. */
  feeRate: 0.05,
  minPricePence: 100,
  maxPricePence: 1_000_000,
  maxActiveListings: 10,
};

export const marketFee = (pricePence: number) => Math.round(pricePence * MARKET.feeRate);

// ───────────────────────────── companies ─────────────────────────────

export const COMPANY = {
  foundingPence: 50_000,
  minEnterprise: 3,
  /** Daily settlement at 18:00 London time. */
  settleHour: 18,
  /** Work sessions that raise a day's takings (more still give progress, up to the progress cap). */
  sessionsCounted: 3,
  progressSessionsPerDay: 4,
  progressPerSession: 10,
  /** Days of missed settlements caught up when the founder returns. */
  maxCatchUpDays: 7,
};

export type SectorId = "cafe" | "studio" | "app" | "events";

export interface SectorDef {
  id: SectorId;
  name: string;
  blurb: string;
  /** Base daily takings at level 1, before enterprise, work and market. */
  baseTakingsPence: number;
  /** Daily running costs at level 1. */
  costsPence: number;
  /** Seeded market roll range: good and bad days. */
  roll: [number, number];
}

export const SECTORS: SectorDef[] = [
  { id: "cafe", name: "Café", blurb: "Steady footfall, steady costs. Rarely a disaster, rarely a windfall.", baseTakingsPence: 6000, costsPence: 2500, roll: [0.8, 1.2] },
  { id: "studio", name: "Creative studio", blurb: "Design and photo commissions. Good weeks and lean weeks.", baseTakingsPence: 7000, costsPence: 3200, roll: [0.65, 1.35] },
  { id: "app", name: "App start-up", blurb: "Cheap to run, wildly uneven. Some days nobody downloads; some days everyone does.", baseTakingsPence: 4500, costsPence: 1200, roll: [0.3, 1.8] },
  { id: "events", name: "Events company", blurb: "Big bookings and big bills. The busiest days pay for the quiet ones.", baseTakingsPence: 9000, costsPence: 4500, roll: [0.6, 1.45] },
];
export const sectorDef = (id: string) => SECTORS.find((s) => s.id === id);

/** Progress needed to reach each level (index 0 = level 1). */
export const COMPANY_LEVELS = [0, 80, 220, 450, 800];
export const COMPANY_MAX_LEVEL = COMPANY_LEVELS.length;
export const LEVEL_TAKINGS = [1, 1.25, 1.5, 1.8, 2.2];
export const LEVEL_COSTS = [1, 1.15, 1.3, 1.45, 1.6];

export function companyLevelFor(progress: number) {
  let level = 1;
  for (let i = 0; i < COMPANY_LEVELS.length; i++) if (progress >= COMPANY_LEVELS[i]) level = i + 1;
  return level;
}

/** Fictional weekly business tax, kept separate from the wage band (DESIGN DEFAULT, not UK tax law). */
export const BUSINESS_TAX = { allowancePence: 25_000, bands: [{ fromPence: 25_000, rate: 0.2 }, { fromPence: 100_000, rate: 0.3 }] };

/** Marginal business tax on `profit` given taxable profit already settled this London week. */
export function businessTax(profitBeforeThisWeekPence: number, profitPence: number) {
  if (profitPence <= 0) return 0;
  const from = Math.max(0, profitBeforeThisWeekPence);
  const to = from + profitPence;
  let tax = 0;
  const bands = BUSINESS_TAX.bands;
  for (let i = 0; i < bands.length; i++) {
    const lo = bands[i].fromPence;
    const hi = bands[i + 1]?.fromPence ?? Infinity;
    const slice = Math.max(0, Math.min(to, hi) - Math.max(from, lo));
    tax += slice * bands[i].rate;
  }
  return Math.round(tax);
}

/** Deterministic 0..1 fraction from a string, so a period's market roll is seeded once and can't be rerolled. */
export function seededFraction(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function marketRoll(sector: SectorDef, seed: string) {
  const [lo, hi] = sector.roll;
  return Math.round((lo + (hi - lo) * seededFraction(seed)) * 1000) / 1000;
}

export interface CompanyDayInput {
  sector: SectorDef;
  level: number;
  enterprise: number;
  sessions: number;
  roll: number;
}

/** One day's trading before tax: takings from enterprise, work and market; costs grow with level. */
export function companyDay({ sector, level, enterprise, sessions, roll }: CompanyDayInput) {
  const lv = Math.min(Math.max(level, 1), COMPANY_MAX_LEVEL) - 1;
  const work = 0.4 + 0.2 * Math.min(Math.max(sessions, 0), COMPANY.sessionsCounted);
  const takings = Math.round(sector.baseTakingsPence * LEVEL_TAKINGS[lv] * (1 + 0.08 * enterprise) * work * roll);
  const costs = Math.round(sector.costsPence * LEVEL_COSTS[lv]);
  return { takings, costs, profit: takings - costs, work };
}

/** Forecast range for a full day's work: clearly an estimate, never a promise. */
export function companyForecast(sector: SectorDef, level: number, enterprise: number) {
  const lo = companyDay({ sector, level, enterprise, sessions: COMPANY.sessionsCounted, roll: sector.roll[0] });
  const hi = companyDay({ sector, level, enterprise, sessions: COMPANY.sessionsCounted, roll: sector.roll[1] });
  return { lowPence: lo.profit, highPence: hi.profit };
}

/** Progress from a settled day: a little for trading at all, more for a profit. */
export const dayProgress = (profit: number) => (profit > 0 ? 5 + Math.min(20, Math.floor(profit / 1000)) : 2);

export function validCompanyName(raw: unknown): string | null {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{N}][\p{L}\p{N} &'.\-]{2,27}$/u.test(name) ? name : null;
}

const WORK_RULE = "Leaving early counts no work towards today's takings.";
export const COMPANY_ACTIVITIES: ActivityDef[] = [
  { id: "company_work_yard", label: "Work on your company", description: "Plan, sell and build at a shared desk. Counts towards today's takings.", location: "east_yard", minutes: 10, costPence: 0, needs: { energy: -6, fun: -2 }, xp: { skill: "enterprise", amount: 12 }, dailyLimit: 3, requiresCompany: true, cancelRule: WORK_RULE, event: "company_work", anchor: "desks" },
  { id: "company_work_home", label: "Work on your company", description: "Answer orders and do the books at your desk.", location: "home", requires: "desk", minutes: 10, costPence: 0, needs: { energy: -5, fun: -3 }, xp: { skill: "enterprise", amount: 8 }, dailyLimit: 3, requiresCompany: true, cancelRule: WORK_RULE, event: "company_work", anchor: "desk" },
];

// ───────────────────────────── player jobs board ─────────────────────────────

export const PLAYER_JOBS = {
  minPayPence: 100,
  maxPayPence: 50_000,
  maxOpenPosted: 5,
  /** Hours a job stays open before unspent escrow returns to the poster. */
  deadlineHours: [12, 24, 48, 72] as const,
  /** After the worker says it's done, the poster has this long to respond before it is approved automatically. */
  responseHours: 24,
};

/** Fixed task templates: no free text on the public board, so nothing needs moderating. */
export const JOB_TEMPLATES = [
  { id: "move_furniture", title: "Help me move furniture", blurb: "Lift, carry and rearrange a room." },
  { id: "decorating_advice", title: "Give me decorating advice", blurb: "Suggest a layout and colours for my home." },
  { id: "party_cooking", title: "Cook for a get-together", blurb: "Help prepare food for friends." },
  { id: "tutoring", title: "Tutor me for an hour", blurb: "Share a skill you're good at." },
  { id: "photo_shoot", title: "Take some photos", blurb: "A short portrait or flat shoot." },
  { id: "errand", title: "Run an errand", blurb: "Pick something up across town." },
  { id: "pitch_practice", title: "Listen to my pitch", blurb: "Hear me out and give honest feedback." },
] as const;
export const jobTemplate = (id: string) => JOB_TEMPLATES.find((t) => t.id === id);
