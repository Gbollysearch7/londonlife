import { VENUES, venue, walkMinutes } from "./world";
import { seededRandom } from "@/sim/shift";

/**
 * Milestone 5 · Transport company (spec ch. 17) and city advertising (spec ch. 27).
 * DESIGN DEFAULTS: fictional game values balanced against the starter wage (about £120 a shift) and the
 * vehicle prices in lateGame.ts. Change as a versioned table; never inline in UI handlers.
 */

// ───────────────────────────── courier firm ─────────────────────────────

export const FIRM = {
  /** One-off registration, licence and branding. */
  registrationPence: 50_000,
  /** Contracts a day each car adds, and the most cars that count towards the daily limit. */
  contractsPerCar: 2,
  maxCarsCounted: 5,
  /** Listings on the daily board. */
  boardSize: 14,
  /** Real minutes a contract takes, before any development time scale. */
  minMinutes: 12,
  maxMinutes: 90,
};

/** Preset name parts: a firm name is picked from these, never typed, so nothing needs moderating. */
export const FIRM_NAME_FIRST = ["Swift", "Kestrel", "Canalside", "Night Owl", "Red Kite", "Thameside", "Greenway", "Lantern", "Pennyfarthing", "Northbank", "Magpie", "Old Bridge"] as const;
export const FIRM_NAME_SECOND = ["Couriers", "Deliveries", "Haulage", "Express", "Logistics", "Van Co", "& Daughters", "& Sons"] as const;

export function firmName(first: unknown, second: unknown): string | null {
  const a = FIRM_NAME_FIRST.find((x) => x === first);
  const b = FIRM_NAME_SECOND.find((x) => x === second);
  return a && b ? `${a} ${b}` : null;
}

/** Firm XP needed for each level (index = level - 1). */
export const FIRM_LEVELS = [0, 8, 24, 50] as const;
export const FIRM_MAX_LEVEL = FIRM_LEVELS.length;

export function firmLevelFor(xp: number) {
  let level = 1;
  for (let i = 0; i < FIRM_LEVELS.length; i++) if (xp >= FIRM_LEVELS[i]) level = i + 1;
  return level;
}

/** Contracts a firm may start in one London day. Abandoned runs still count. */
export function dailyContractLimit(cars: number, level: number) {
  if (cars <= 0) return 0;
  return Math.min(cars, FIRM.maxCarsCounted) * FIRM.contractsPerCar + (level - 1);
}

export type ContractTier = "parcel" | "priority" | "haulage" | "specialist";

export interface TierDef {
  name: string;
  minLevel: number;
  /** Boot space needed: compact cars carry 1, family cars and saloons 2. */
  cargo: number;
  basePence: number;
  perMinutePence: number;
  /** The driver's wage for the run, paid out of the fee on completion. */
  driverPence: number;
  /** Loading and unloading time on top of the drive. */
  loadMinutes: number;
  /** Extra condition lost to heavy loads. */
  extraWear: number;
  xp: number;
  goods: string[];
}

export const TIERS: Record<ContractTier, TierDef> = {
  parcel: { name: "Parcel run", minLevel: 1, cargo: 1, basePence: 1200, perMinutePence: 60, driverPence: 300, loadMinutes: 6, extraWear: 0, xp: 1, goods: ["a box of books", "printed menus", "a birthday cake", "a bag of vinyl records", "spare keys", "a tray of seedlings"] },
  priority: { name: "Priority courier", minLevel: 2, cargo: 1, basePence: 2000, perMinutePence: 90, driverPence: 600, loadMinutes: 4, extraWear: 0, xp: 2, goods: ["signed contracts", "a replacement laptop", "theatre costumes", "a wedding dress", "camera lenses"] },
  haulage: { name: "Haulage", minLevel: 3, cargo: 2, basePence: 3500, perMinutePence: 110, driverPence: 1000, loadMinutes: 14, extraWear: 2, xp: 3, goods: ["stage lighting rigs", "flat-pack shelving", "market stall frames", "crates of produce", "a pallet of paint"] },
  specialist: { name: "Specialist delivery", minLevel: 4, cargo: 2, basePence: 5000, perMinutePence: 140, driverPence: 1400, loadMinutes: 12, extraWear: 1, xp: 4, goods: ["a gallery painting", "a concert cello", "chilled catering", "a museum display case"] },
};

/** How much each car can carry; anything not listed carries 1. */
const CARGO: Record<string, number> = { compact_car: 1, family_car: 2, electric_saloon: 2 };
export const cargoOf = (vehicleDefId: string) => CARGO[vehicleDefId] ?? 1;

/** Board mix by slot: easier work first, so every firm always has something to do. */
const BOARD_TIERS: ContractTier[] = ["parcel", "parcel", "parcel", "priority", "parcel", "priority", "haulage", "priority", "haulage", "specialist", "parcel", "priority", "haulage", "specialist"];

export interface Listing {
  slot: number;
  tier: ContractTier;
  pickup: string;
  dropoff: string;
  goods: string;
  minutes: number;
  payPence: number;
  driverPence: number;
  /** London hour (on the board's day) by which the delivery must be completed. */
  deadlineHour: number;
}

/** Places goods are collected from and delivered to: every venue except players' homes. */
const DEPOTS = VENUES.filter((v) => v.id !== "home").map((v) => v.id);

/**
 * The day's contract board. Pure and seeded by the London day, so everyone sees the same listings and a
 * reload never re-rolls them. Each firm can run each listing once.
 */
export function boardFor(dayKey: string): Listing[] {
  const rand = seededRandom(`courier:${dayKey}`);
  const out: Listing[] = [];
  for (let slot = 0; slot < FIRM.boardSize; slot++) {
    const tier = BOARD_TIERS[slot % BOARD_TIERS.length];
    const t = TIERS[tier];
    const pickup = DEPOTS[Math.floor(rand() * DEPOTS.length)];
    let dropoff = DEPOTS[Math.floor(rand() * DEPOTS.length)];
    if (dropoff === pickup) dropoff = DEPOTS[(DEPOTS.indexOf(pickup) + 1 + Math.floor(rand() * (DEPOTS.length - 1))) % DEPOTS.length];
    const drive = Math.round(walkMinutes(pickup, dropoff) * 0.32);
    const minutes = Math.max(FIRM.minMinutes, Math.min(FIRM.maxMinutes, drive + t.loadMinutes));
    const variance = 0.85 + rand() * 0.3;
    const payPence = Math.round(((t.basePence + t.perMinutePence * minutes) * variance) / 10) * 10;
    const goods = t.goods[Math.floor(rand() * t.goods.length)];
    const deadlineHour = 13 + Math.floor(rand() * 11);
    out.push({ slot, tier, pickup, dropoff, goods, minutes, payPence, driverPence: t.driverPence, deadlineHour });
  }
  return out;
}

/** Fuel or charge for a run: the car's per-trip cost for every started quarter hour. */
export function contractFuel(tripPence: number, minutes: number) {
  return tripPence * Math.ceil(minutes / 15);
}

/** Condition lost on a run: the car's per-trip wear for every started 20 minutes, plus heavy-load wear. */
export function contractWear(wearPerTrip: number, minutes: number, tier: ContractTier) {
  return wearPerTrip * Math.ceil(minutes / 20) + TIERS[tier].extraWear;
}

export const listingTitle = (l: Pick<Listing, "pickup" | "dropoff">) => `${venue(l.pickup)?.name ?? l.pickup} → ${venue(l.dropoff)?.name ?? l.dropoff}`;

// ───────────────────────────── city advertising ─────────────────────────────

export interface AdSite {
  id: string;
  name: string;
  /** Where it's shown: a venue id, or "street" for the journey street scene. */
  where: string;
  blurb: string;
  /** Price for a full week. */
  pricePence: number;
  /** Ads that rotate on the site in one week. */
  slots: number;
}

export const AD_SITES: AdSite[] = [
  { id: "high_street", name: "High Street bus shelters", where: "street", blurb: "Shelter panels along the high street, seen by everyone on a journey.", pricePence: 12_000, slots: 3 },
  { id: "south_bank", name: "Riverside hoarding", where: "south_bank", blurb: "A tall hoarding on the South Bank promenade.", pricePence: 20_000, slots: 2 },
  { id: "borough_market", name: "Market arch poster", where: "borough_market", blurb: "Above the stalls on the brick arch at Borough Market.", pricePence: 15_000, slots: 2 },
  { id: "regents_green", name: "Park gate board", where: "regents_green", blurb: "Behind the hedge at the park's main path.", pricePence: 10_000, slots: 2 },
  { id: "stadium", name: "Stadium big board", where: "borough_stadium", blurb: "Behind the stands at Borough Stadium. Match days are busy.", pricePence: 30_000, slots: 2 },
];

export const adSite = (id: string) => AD_SITES.find((s) => s.id === id);

export const AD_TEMPLATES = [
  { id: "bold", name: "Bold banner", blurb: "Big slogan on a solid colour." },
  { id: "classic", name: "Classic poster", blurb: "Framed, with a serif headline." },
  { id: "neon", name: "Neon night", blurb: "Glowing lettering on a dark board." },
  { id: "chalk", name: "Chalkboard", blurb: "Hand-lettered market style." },
] as const;
export type AdTemplate = (typeof AD_TEMPLATES)[number]["id"];

export const AD_COLOURS = [
  { id: "racing", name: "Racing green", hex: "#234C42" },
  { id: "pillar", name: "Pillar-box red", hex: "#BC3D3B" },
  { id: "navy", name: "Thames navy", hex: "#2F4A6B" },
  { id: "mustard", name: "Mustard", hex: "#C69C58" },
  { id: "plum", name: "Plum", hex: "#6B3A5A" },
  { id: "teal", name: "Canal teal", hex: "#2F8A7F" },
] as const;
export type AdColour = (typeof AD_COLOURS)[number]["id"];

/** Pre-written slogans only: no free text reaches a public billboard. */
export const AD_SLOGANS = [
  { id: "fresh", text: "Fresh from the neighbourhood" },
  { id: "kettle", text: "Put the kettle on. We've got this." },
  { id: "rain", text: "Rain or shine, always on time" },
  { id: "local", text: "Proudly local since this morning" },
  { id: "friendly", text: "Friendly faces, fair prices" },
  { id: "worth", text: "Worth the bus fare" },
  { id: "best", text: "The best thing on this street" },
  { id: "quick", text: "Quick, careful, cheerful" },
  { id: "hello", text: "Come and say hello" },
  { id: "new", text: "New in town. Here to stay." },
  { id: "mind", text: "Mind the gap in your diary" },
  { id: "proper", text: "A proper London welcome" },
] as const;
export type AdSlogan = (typeof AD_SLOGANS)[number]["id"];

/** Who the ad is for: your name or your courier firm's preset name. */
export type AdBrand = "name" | "firm";

export const AD_RULES = {
  /** Ads you can have booked in any one week, across all sites. */
  maxPerWeek: 2,
  /** This week and next week can be booked. */
  weeksAhead: 1,
  /** Chance a site is out of use for a week (scaffolding, repairs); booked ads are then refunded. */
  downChance: 0.06,
};

const DOWN_REASONS = ["Scaffolding went up over the site this week.", "The panel is being repaired this week.", "Street works closed the site this week."];

/**
 * Whether a site can't show ads in a week, decided once per site and week by a seed. It is only revealed
 * when the week starts; booked ads for a site that's down are refunded in full.
 */
export function siteDown(siteId: string, weekKey: string): string | null {
  const rand = seededRandom(`adsite:${siteId}:${weekKey}`);
  if (rand() >= AD_RULES.downChance) return null;
  return DOWN_REASONS[Math.floor(rand() * DOWN_REASONS.length)];
}

/** Price for the rest of a week: whole days remaining (at least one) out of seven, rounded to 10p. */
export function adPrice(site: AdSite, remainingMs: number) {
  const days = Math.max(1, Math.min(7, Math.ceil(remainingMs / 86_400_000)));
  return Math.round((site.pricePence * days) / 7 / 10) * 10;
}

export function sloganText(id: string) {
  return AD_SLOGANS.find((s) => s.id === id)?.text ?? "";
}

export function colourHex(id: string) {
  return AD_COLOURS.find((c) => c.id === id)?.hex ?? AD_COLOURS[0].hex;
}
