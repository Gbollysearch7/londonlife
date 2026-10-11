import { seededRandom } from "@/sim/shift";

/**
 * Milestone 5 · investment homes, land plots and construction (spec ch. 11, 17).
 * DESIGN DEFAULTS: fictional game values, not a claim about real London property. This catalogue is a
 * separate product from the residential homes in character.ts: never price one from the other.
 */

export interface InvestmentHomeDef {
  id: string;
  name: string;
  district: string;
  /** Base price before the district's weekly valuation drift. */
  pricePence: number;
  /** Weekly rent from an NPC tenant in a full, occupied week. */
  rentPence: number;
  /** Weekly upkeep: repairs, cleaning between tenants and the letting agent, charged every week. */
  maintenancePence: number;
  /** Chance that a given week has no tenant (0–1). */
  vacancy: number;
  /** Only produced by finishing a building on a plot; not sold in the catalogue. */
  buildOnly?: boolean;
  blurb: string;
}

export const INVESTMENT_HOMES: InvestmentHomeDef[] = [
  { id: "inv_camden_studio", name: "Camden ex-council studio", district: "Camden", pricePence: 1_200_000, rentPence: 13_500, maintenancePence: 2_000, vacancy: 0.12, blurb: "Compact, tidy and always in demand with students. Let through Pip's Lettings (NPC agent)." },
  { id: "inv_brixton_flat", name: "Brixton flat above a bakery", district: "Brixton", pricePence: 2_400_000, rentPence: 26_000, maintenancePence: 3_500, vacancy: 0.1, blurb: "Two rooms over the ovens. Tenants say it smells wonderful every morning." },
  { id: "inv_shoreditch_loft", name: "Shoreditch warehouse loft", district: "Shoreditch", pricePence: 4_800_000, rentPence: 50_000, maintenancePence: 7_000, vacancy: 0.15, blurb: "Exposed brick, huge windows and creative tenants who come and go." },
  { id: "inv_greenwich_house", name: "Greenwich cottage", district: "Greenwich", pricePence: 7_500_000, rentPence: 74_000, maintenancePence: 9_000, vacancy: 0.08, blurb: "A little house by the park. Families sign long tenancies here." },
  { id: "inv_southbank_apartment", name: "South Bank river apartment", district: "South Bank", pricePence: 14_000_000, rentPence: 135_000, maintenancePence: 18_000, vacancy: 0.1, blurb: "Balcony views of the Thames, managed by Riverside Lets (NPC agent)." },
  // Buildings finished on plots become these.
  { id: "bld_kingscross_mews", name: "King's Cross mews house (self-built)", district: "King's Cross", pricePence: 5_400_000, rentPence: 52_000, maintenancePence: 6_000, vacancy: 0.08, buildOnly: true, blurb: "The mews house you built yourself, brick by brick." },
  { id: "bld_brixton_terrace", name: "Brixton new-build terrace (self-built)", district: "Brixton", pricePence: 3_700_000, rentPence: 36_000, maintenancePence: 4_000, vacancy: 0.1, buildOnly: true, blurb: "A modern terrace on what used to be a garage yard." },
  { id: "bld_greenwich_villa", name: "Greenwich garden villa (self-built)", district: "Greenwich", pricePence: 12_000_000, rentPence: 110_000, maintenancePence: 12_000, vacancy: 0.07, buildOnly: true, blurb: "Your architect-designed villa with a garden down to the old wall." },
];

export interface BuildStage {
  costPence: number;
  /** Real minutes before any development time scale. */
  minutes: number;
}

export interface PlotDef {
  id: string;
  name: string;
  district: string;
  pricePence: number;
  /** A game label only. */
  title: "Freehold" | "Leasehold";
  /** The investment home a finished building becomes. */
  buildsId: string;
  /** Foundations, frame, roof, fit-out — in order. */
  stages: [BuildStage, BuildStage, BuildStage, BuildStage];
  blurb: string;
}

export const STAGE_NAMES = ["Foundations", "Frame", "Roof", "Fit-out"] as const;

export const PLOTS: PlotDef[] = [
  {
    id: "plot_brixton_yard",
    name: "Brixton garage yard",
    district: "Brixton",
    pricePence: 600_000,
    title: "Leasehold",
    buildsId: "bld_brixton_terrace",
    stages: [
      { costPence: 400_000, minutes: 240 },
      { costPence: 700_000, minutes: 480 },
      { costPence: 400_000, minutes: 360 },
      { costPence: 600_000, minutes: 720 },
    ],
    blurb: "A row of tumbledown lock-ups with planning for a small terrace.",
  },
  {
    id: "plot_kingscross_mews",
    name: "King's Cross mews plot",
    district: "King's Cross",
    pricePence: 1_000_000,
    title: "Freehold",
    buildsId: "bld_kingscross_mews",
    stages: [
      { costPence: 600_000, minutes: 360 },
      { costPence: 1_000_000, minutes: 720 },
      { costPence: 600_000, minutes: 480 },
      { costPence: 900_000, minutes: 1080 },
    ],
    blurb: "A cobbled corner behind the canal, cleared and ready for a mews house.",
  },
  {
    id: "plot_greenwich_garden",
    name: "Greenwich walled garden",
    district: "Greenwich",
    pricePence: 2_500_000,
    title: "Freehold",
    buildsId: "bld_greenwich_villa",
    stages: [
      { costPence: 1_200_000, minutes: 480 },
      { costPence: 2_200_000, minutes: 960 },
      { costPence: 1_300_000, minutes: 720 },
      { costPence: 2_000_000, minutes: 1440 },
    ],
    blurb: "An overgrown garden plot behind an old brick wall, approved for one villa.",
  },
];

export const PROPERTY_RULES = {
  maxHomes: 5,
  maxPlots: 20,
  /** Agent and legal fees taken from a sale's valuation. */
  saleFee: 0.05,
  /** Rent the letting agent holds for you while you're away: at most this many weeks are paid on return. */
  maxCatchUpWeeks: 13,
  /** Valuations drift weekly within these bounds of the base price. */
  minFactor: 0.85,
  maxFactor: 1.25,
  /** Largest random weekly move either way (before the small upward lean). */
  maxStep: 0.03,
};

/** Income and valuation weeks start on Saturday 09:00 London, alongside rent. */
export const PROPERTY_WEEKLY = { isoWeekday: 6, hour: 9 };

export const investmentDef = (id: string) => INVESTMENT_HOMES.find((h) => h.id === id);
export const plotDef = (id: string) => PLOTS.find((p) => p.id === id);

// ───────────────────────────── valuation ─────────────────────────────

/** Valuation weeks count from Saturday 3 January 2026 (09:00 UTC); before then the factor is 1. */
const EPOCH = Date.UTC(2026, 0, 3, 9);
const WEEK_MS = 7 * 86_400_000;
const MAX_WEEKS = 5200;
const walks = new Map<string, number[]>();

export function valuationWeek(at: Date) {
  return Math.min(MAX_WEEKS, Math.max(0, Math.floor((at.getTime() - EPOCH) / WEEK_MS)));
}

/**
 * A district's price factor for the week containing `at`: a seeded random walk from the epoch,
 * clamped to the bounds, so every player sees the same market and it never runs away.
 */
export function valuationFactor(seedKey: string, at: Date) {
  const week = valuationWeek(at);
  let walk = walks.get(seedKey);
  if (!walk) walks.set(seedKey, (walk = [1]));
  for (let i = walk.length; i <= week; i++) {
    const r = seededRandom(`valuation:${seedKey}:${i}`)();
    // Up to maxStep either way, with a gentle upward lean (+0.3% a week on average), inside the bounds.
    const step = (r * 2 - 1) * PROPERTY_RULES.maxStep + 0.003;
    walk.push(Math.min(PROPERTY_RULES.maxFactor, Math.max(PROPERTY_RULES.minFactor, walk[i - 1] * (1 + step))));
  }
  return walk[week];
}

/** Rounded to whole pounds. */
const pounds = (p: number) => Math.round(p / 100) * 100;

export function homeValuation(def: InvestmentHomeDef, at: Date) {
  return pounds(def.pricePence * valuationFactor(`home:${def.district}`, at));
}

export function plotValuation(def: PlotDef, at: Date) {
  return pounds(def.pricePence * valuationFactor(`land:${def.district}`, at));
}

export const saleProceeds = (valuation: number) => valuation - Math.round(valuation * PROPERTY_RULES.saleFee);

/** Whether a property has a tenant in a given income week; fixed by its seed. */
export function occupiedWeek(propertyId: string, weekKey: string, def: InvestmentHomeDef) {
  return seededRandom(`vacancy:${propertyId}:${weekKey}`)() >= def.vacancy;
}

/** Current valuations keyed for SQL lookups: "inv:<homeId>" and "plot:<plotId>". */
export function valuationKeys(at: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of INVESTMENT_HOMES) out[`inv:${h.id}`] = homeValuation(h, at);
  for (const p of PLOTS) out[`plot:${p.id}`] = plotValuation(p, at);
  return out;
}
