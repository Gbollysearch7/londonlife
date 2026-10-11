import type { ActivityDef, FurnitureDef, ItemDef } from "./types";
import { seededRandom } from "@/sim/shift";

/**
 * Milestone 5 · late-game assets (spec ch. 14, 24, 34).
 * DESIGN DEFAULTS: fictional game values balanced against the starter wage (about £120 a shift),
 * not real London prices. Change as a versioned table; never inline in UI handlers.
 */

// ───────────────────────────── vehicles ─────────────────────────────

export type VehicleMode = "cycle" | "drive";

export interface VehicleDef {
  id: string;
  name: string;
  /** Which journey mode owning it unlocks. */
  mode: VehicleMode;
  pricePence: number;
  /** Weekly upkeep: insurance, parking, charging or servicing plan, folded into one charge. */
  upkeepPence: number;
  /** Fuel or charge per journey. */
  tripPence: number;
  /** Journey time as a fraction of walking time (lower is faster). Bus is 0.4. */
  speed: number;
  /** Condition points lost per journey. */
  wearPerTrip: number;
  /** Cost of a full service from 0% back to 100%; partial services are prorated. */
  servicePence: number;
  colours: string[];
  blurb: string;
}

export const VEHICLES: VehicleDef[] = [
  { id: "bicycle", name: "Town bicycle", mode: "cycle", pricePence: 25000, upkeepPence: 300, tripPence: 0, speed: 0.6, wearPerTrip: 3, servicePence: 4000, colours: ["#234C42", "#BC3D3B", "#2F4A6B", "#C69C58"], blurb: "Free to ride and faster than walking. Mind the rain." },
  { id: "e_scooter", name: "Electric scooter", mode: "cycle", pricePence: 60000, upkeepPence: 600, tripPence: 0, speed: 0.5, wearPerTrip: 3, servicePence: 6000, colours: ["#17232B", "#F2F0EA", "#3FAE7A"], blurb: "Zippy, folds up, charges at home (included in upkeep)." },
  { id: "compact_car", name: "Used compact car", mode: "drive", pricePence: 450000, upkeepPence: 4500, tripPence: 300, speed: 0.32, wearPerTrip: 2, servicePence: 30000, colours: ["#8C8C84", "#BC3D3B", "#2F4A6B"], blurb: "A tidy runabout with a few miles on the clock." },
  { id: "family_car", name: "Family car", mode: "drive", pricePence: 1200000, upkeepPence: 7000, tripPence: 400, speed: 0.32, wearPerTrip: 2, servicePence: 40000, colours: ["#F2F0EA", "#234C42", "#17232B"], blurb: "Room for everyone and the shopping. Comfortable and reliable." },
  { id: "electric_saloon", name: "Electric saloon", mode: "drive", pricePence: 3200000, upkeepPence: 9000, tripPence: 150, speed: 0.28, wearPerTrip: 1, servicePence: 50000, colours: ["#17232B", "#F2F0EA", "#7F95A8", "#BC3D3B"], blurb: "Quiet, quick and cheap per trip. Charging is folded into upkeep." },
];

export const vehicleDef = (id: string) => VEHICLES.find((v) => v.id === id);

export const VEHICLE_RULES = {
  maxOwned: 10,
  /** Resale at full condition, as a fraction of the price paid. */
  resaleFraction: 0.6,
  /** Below this condition a vehicle is unsafe to use until serviced. */
  minCondition: 30,
  /** Real minutes from purchase to delivery at your home (scaled in development). */
  deliveryMinutes: 30,
};

/** Resale: 60% of the price paid at full condition, sliding to 36% at 0% condition. */
export function vehicleResale(pricePaid: number, condition: number) {
  return Math.round(pricePaid * VEHICLE_RULES.resaleFraction * (0.6 + (0.4 * Math.max(0, Math.min(100, condition))) / 100));
}

/** Service price to restore a vehicle to 100%: proportional to the missing condition, whole pence. */
export function serviceCost(def: VehicleDef, condition: number) {
  return Math.ceil((def.servicePence * Math.max(0, 100 - condition)) / 100);
}

// ───────────────────────────── insurance ─────────────────────────────

export type PolicyKind = "home" | "possessions";
export type HazardKind = "burst_pipe" | "phone_snatched" | "bike_stolen";

export const POLICIES: Record<PolicyKind, { name: string; basePremiumPence: number; excessPence: number; covers: HazardKind[]; blurb: string; exclusions: string }> = {
  home: {
    name: "Home cover",
    basePremiumPence: 500,
    excessPence: 2500,
    covers: ["burst_pipe"],
    blurb: "Water damage and repairs at home after a burst pipe.",
    exclusions: "Doesn't cover anything that happened before your cover started, or your phone or bikes.",
  },
  possessions: {
    name: "Possessions cover",
    basePremiumPence: 350,
    excessPence: 1500,
    covers: ["phone_snatched", "bike_stolen"],
    blurb: "Your phone if it's snatched, and bicycles or scooters if they're stolen.",
    exclusions: "Doesn't cover cars, damage at home, or anything that happened before your cover started.",
  },
};

export const HAZARDS: Record<HazardKind, { name: string; policy: PolicyKind; weight: number; lossPence: [number, number]; blurb: string }> = {
  burst_pipe: { name: "Burst pipe", policy: "home", weight: 0.4, lossPence: [6000, 18000], blurb: "A pipe burst and soaked the floor. Repairs and drying out were needed." },
  phone_snatched: { name: "Phone snatched", policy: "possessions", weight: 0.35, lossPence: [9000, 16000], blurb: "Someone on a bike grabbed your phone. You bought a replacement." },
  // Loss is the stolen vehicle's value; it only happens if you own a bicycle or scooter that isn't in use.
  bike_stolen: { name: "Bike stolen", policy: "possessions", weight: 0.25, lossPence: [0, 0], blurb: "Your bike or scooter was taken from where it was locked up." },
};

/** Fictional weekly risk forecasts. `risk` is the chance of at least one incident in the week (sampled once). */
export const FORECASTS = [
  { id: "settled", name: "Settled week", risk: 0.08, premiumMult: 0.8, blurb: "Dry and calm. Low risk." },
  { id: "changeable", name: "Changeable week", risk: 0.14, premiumMult: 1, blurb: "Some showers and busy streets. Normal risk." },
  { id: "stormy", name: "Stormy week", risk: 0.22, premiumMult: 1.3, blurb: "Cold snaps and wild weather. Higher risk." },
] as const;
export type Forecast = (typeof FORECASTS)[number];

/** Uninsured losses are capped, and low earners pay only a share (the rest is hardship relief). */
export const HARDSHIP = {
  /** Most an uninsured incident can cost in cash. */
  uninsuredCapPence: 5000,
  /** Earnings in the last seven days below this count as low income (about three starter shifts). */
  lowIncomePence: 40000,
  /** Share of the capped loss a low earner pays. */
  lowIncomeShare: 0.25,
  /** No incidents in a character's first week in London. */
  newcomerDays: 7,
};

/** The forecast for an insurance week. One value per week for everyone; never re-sampled per render. */
export function forecastFor(weekKey: string): Forecast {
  const r = seededRandom(`forecast:${weekKey}`)();
  return r < 0.35 ? FORECASTS[0] : r < 0.8 ? FORECASTS[1] : FORECASTS[2];
}

export function premiumFor(kind: PolicyKind, weekKey: string) {
  return Math.round((POLICIES[kind].basePremiumPence * forecastFor(weekKey).premiumMult) / 10) * 10;
}

export interface HazardRoll {
  kind: HazardKind;
  /** Instant of the incident within the week. */
  at: Date;
  /** Assessed loss before cover or caps (0 for a stolen bike: its value is used instead). */
  lossPence: number;
}

/**
 * The single incident (or none) a character faces in an insurance week, decided by a seed of the
 * character and the week. Pure and deterministic: rendering or reloading never re-rolls it.
 */
export function hazardFor(characterId: string, weekKey: string, weekStart: Date): HazardRoll | null {
  const rand = seededRandom(`hazard:${characterId}:${weekKey}`);
  if (rand() >= forecastFor(weekKey).risk) return null;
  let pick = rand();
  let kind: HazardKind = "burst_pipe";
  for (const [k, h] of Object.entries(HAZARDS) as [HazardKind, (typeof HAZARDS)[HazardKind]][]) {
    if (pick < h.weight) {
      kind = k;
      break;
    }
    pick -= h.weight;
  }
  // Between six hours after the week opens and six hours before it closes.
  const at = new Date(weekStart.getTime() + 6 * 3_600_000 + Math.floor(rand() * (7 * 24 - 12) * 3_600_000));
  const [lo, hi] = HAZARDS[kind].lossPence;
  const lossPence = Math.round((lo + rand() * (hi - lo)) / 100) * 100;
  return { kind, at, lossPence };
}

/** What an uninsured player pays for a loss (before the "can't go below zero" cap). */
export function uninsuredShare(lossPence: number, lowIncome: boolean) {
  const capped = Math.min(lossPence, HARDSHIP.uninsuredCapPence);
  return lowIncome ? Math.round(capped * HARDSHIP.lowIncomeShare) : capped;
}

// ───────────────────────────── pets ─────────────────────────────

export type PetKind = "cat" | "dog";
export type PetCare = "feed" | "play" | "clean" | "rest";

export const PET_KINDS: Record<PetKind, { name: string; adoptionPence: number; foodPerDay: number; decayPerHour: number; colours: string[]; blurb: string }> = {
  cat: { name: "Cat", adoptionPence: 6000, foodPerDay: 1, decayPerHour: 2.5, colours: ["#2b2f36", "#c98a4b", "#f2f0ea", "#8c8c84"], blurb: "Independent, curious and fond of warm windowsills." },
  dog: { name: "Dog", adoptionPence: 9000, foodPerDay: 2, decayPerHour: 3.5, colours: ["#c69c58", "#4a3a2c", "#f2f0ea", "#2b2f36"], blurb: "Loyal, playful and always pleased to see you." },
};

export const PET_FOOD_ID = "pet_food";

export const PET_CARE: Record<PetCare, { label: string; gain: number; cooldownMin: number; consumes?: Record<string, number>; owner?: { fun?: number; social?: number }; blurb: string }> = {
  feed: { label: "Feed", gain: 35, cooldownMin: 120, consumes: { [PET_FOOD_ID]: 1 }, blurb: "Uses one tin of pet food." },
  play: { label: "Play", gain: 20, cooldownMin: 60, owner: { fun: 6, social: 3 }, blurb: "Good for both of you." },
  clean: { label: "Groom", gain: 15, cooldownMin: 240, blurb: "A brush and a tidy of their bed." },
  rest: { label: "Settle down", gain: 10, cooldownMin: 90, blurb: "A quiet nap in their bed." },
};

export const PET_RULES = {
  maxPets: 2,
  startWellbeing: 80,
  /** Wellbeing never drops below this: neglect prompts care, it never causes permanent harm. */
  floor: 15,
  /** Below this the app and a notice prompt you to care for them. */
  prompt: 35,
  /** A single settlement never applies more than this many hours (same idea as needs). */
  offlineCapHours: 8,
};

export function petWellbeing(stored: number, settledAt: Date, now: Date, kind: PetKind) {
  const hours = Math.min(PET_RULES.offlineCapHours, Math.max(0, (now.getTime() - settledAt.getTime()) / 3_600_000));
  if (stored <= PET_RULES.floor) return stored;
  return Math.max(PET_RULES.floor, stored - hours * PET_KINDS[kind].decayPerHour);
}

export const PET_FOOD: ItemDef = { id: PET_FOOD_ID, name: "Pet food", kind: "grocery", pricePence: 120, unit: "tin" };

// ───────────────────────────── prestige furniture ─────────────────────────────

export const PRESTIGE_FURNITURE: FurnitureDef[] = [
  { id: "original_artwork", name: "Original Painting", category: "Decor", pricePence: 120000, w: 1, d: 1, surface: "wall", quality: 3, colours: ["#2F4A6B", "#BC3D3B", "#C69C58"], enables: [], decor: 3, blurb: "An original canvas by a fictional local painter. Lifts mood; décor is capped." },
  { id: "home_cinema", name: "Home Cinema", category: "Fun", pricePence: 250000, w: 3, d: 1, surface: "floor", quality: 3, colours: ["#17232B", "#3A3A3A"], enables: ["cinema"], blurb: "A wide screen and speakers. A film night restores lots of Fun." },
  { id: "grand_piano", name: "Grand Piano", category: "Skills", pricePence: 600000, w: 2, d: 2, surface: "floor", quality: 3, colours: ["#111111", "#F2F0EA"], enables: ["piano"], blurb: "Practise Music 50% faster than on a guitar." },
  { id: "workstation", name: "Advanced Workstation", category: "Skills", pricePence: 300000, w: 2, d: 1, surface: "floor", quality: 3, colours: ["#2b2f36", "#F2F0EA"], enables: ["workstation"], blurb: "Three screens and a fast machine: Coding XP 50% faster than a laptop desk." },
];

const NO_REFUND = "Cancelling ends the activity with no reward; costs already paid are not refunded.";

export const PRESTIGE_ACTIVITIES: ActivityDef[] = [
  { id: "watch_cinema", label: "Film night", description: "A feature on the big screen. Restores much more Fun than TV.", location: "home", requires: "cinema", minutes: 12, costPence: 0, needs: { fun: 45, energy: -2 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "cinema" },
  { id: "practise_piano", label: "Practise piano", description: "Trains Music faster than a guitar.", location: "home", requires: "piano", minutes: 10, costPence: 0, needs: { fun: 14 }, xp: { skill: "music", amount: 30 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "music" }, anchor: "piano" },
  { id: "workstation_sprint", label: "Deep work session", description: "Build something on the workstation. Trains Coding faster than a laptop desk.", location: "home", requires: "workstation", minutes: 10, costPence: 0, needs: { energy: -4 }, xp: { skill: "coding", amount: 30 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "coding" }, anchor: "workstation" },
];
