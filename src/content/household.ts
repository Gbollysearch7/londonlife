import type { ActivityDef, ItemDef } from "./types";

/**
 * HOUSEHOLD SYSTEMS (spec ch. 9, 12, 13, 19, 31). DESIGN DEFAULTS — fictional game values, not real
 * London prices or real utility companies. Change as a table; never inline in handlers or UI.
 */

// ───────────────────────────── utilities ─────────────────────────────

/** Weekly energy and water bill by home tier, billed with rent every Saturday 09:00 (owned homes pay too). */
export const UTILITIES_PENCE: Record<string, number> = {
  student_hall: 600,
  shared_room: 1000,
  outer_studio: 1600,
  one_bed: 2200,
  brixton_terrace: 3800,
  soho_townhouse: 7000,
  riverside_penthouse: 12000,
};
export const utilitiesFor = (tierId: string) => UTILITIES_PENCE[tierId] ?? 1000;

/**
 * Occasional fictional outages: at most one per London week, deterministic per character and week
 * (never re-rolled on reload). A game event, not a claim about any real utility service.
 */
export const OUTAGE = {
  /** Chance that a given week has an outage. */
  weeklyChance: 0.6,
  /** Outage length in London hours. */
  hours: 3,
  /** Earliest and latest start hour (London time); outages end by 22:00. */
  startHours: [8, 19] as [number, number],
};

export const OUTAGE_KINDS = {
  hot_water: {
    name: "Hot-water outage",
    blurb: "The boiler's being repaired, so there's no hot water at home.",
    /** Home furniture tags that stop working. */
    blocks: ["shower"],
    recovery: "Free showers: The Common Room or the changing rooms at Borough Athletics.",
  },
  power: {
    name: "Power cut",
    blurb: "A fictional fault on the street has cut the electricity.",
    blocks: ["tv", "desk"],
    recovery: "The gas hob still works, so you can cook. The Reading Room and The Common Room have lights and computers.",
  },
} as const;
export type OutageKind = keyof typeof OUTAGE_KINDS;

// ───────────────────────────── household staff ─────────────────────────────

export interface StaffDef {
  id: "cleaner" | "chef";
  name: string;
  /** Weekly wage, billed with rent; the first week is prorated to the next Saturday 09:00. */
  wagePence: number;
  /** Smallest home (grid width) that has room for this role. */
  minGrid: number;
  services: string;
  blurb: string;
}

export const STAFF: StaffDef[] = [
  {
    id: "cleaner",
    name: "Cleaner",
    wagePence: 4500,
    minGrid: 7,
    services: "Cleans every week, so the place always feels fresh: +4 mood while employed.",
    blurb: "Needs a studio flat or bigger.",
  },
  {
    id: "chef",
    name: "Chef",
    wagePence: 9000,
    minGrid: 8,
    services: "Cooks up to 3 meals a day for you to collect at home. Meals go into your kitchen cupboard.",
    blurb: "Needs a one-bedroom flat or bigger.",
  },
];
export const staffDef = (id: string) => STAFF.find((s) => s.id === id);

/** Mood bonus from a cleaner whose wages are paid up. */
export const CLEANER_MOOD = 4;
/** Chef meals per London day (source-observed cap of three). */
export const CHEF_MEALS_PER_DAY = 3;

/** What the chef cooks: rotates through the day. Eaten with the normal "Eat …" action at home. */
export const CHEF_MEALS: ItemDef[] = [
  { id: "chef_pie_and_mash", name: "Chef's pie and mash", kind: "meal", eat: { hunger: 55, fun: 8, energy: 4 } },
  { id: "chef_rice_and_peas", name: "Chef's rice and peas with stew", kind: "meal", eat: { hunger: 55, fun: 10 } },
  { id: "chef_full_breakfast", name: "Chef's full breakfast", kind: "meal", eat: { hunger: 50, energy: 8, fun: 6 } },
];

// ───────────────────────────── house parties ─────────────────────────────

export const PARTY = {
  /** Most NPC friends who come; the rest are busy. */
  maxGuests: 5,
  /** Extra need gains per guest who comes, applied once when the party ends. */
  perGuest: { social: 5, fun: 2 },
  /** NPC friendship tier (index into FRIEND_TIERS) needed to be invited: 2 = Friend. */
  friendTier: 2,
};

const PARTY_RULE = "Snacks and drinks are used as soon as the party starts and aren't returned if you end it early.";

/** Two ways to host: buy party food in, or use what's in your cupboard. One party per night either way. */
export const PARTY_ACTIVITIES: ActivityDef[] = [
  {
    id: "house_party",
    label: "Throw a house party",
    description: "Put the speakers on and buy in snacks and drinks (£20). NPC friends you've got to know may come.",
    location: "home",
    requires: "speakers",
    minutes: 30,
    costPence: 2000,
    needs: { fun: 30, social: 25, energy: -10, hunger: -4 },
    hours: [17, 26],
    dailyLimit: 1,
    minEnergy: 20,
    cancelRule: PARTY_RULE,
    event: "house_party",
    anchor: "speakers",
  },
  {
    id: "house_party_pantry",
    label: "Throw a house party (cupboard snacks)",
    description: "Put the speakers on and share food from your cupboard. NPC friends you've got to know may come.",
    location: "home",
    requires: "speakers",
    minutes: 30,
    costPence: 0,
    consumes: { snack_bar: 3, bread: 2, tea: 3 },
    needs: { fun: 30, social: 25, energy: -10, hunger: -4 },
    hours: [17, 26],
    dailyLimit: 1,
    minEnergy: 20,
    cancelRule: PARTY_RULE,
    event: "house_party",
    anchor: "speakers",
  },
];
export const PARTY_IDS = PARTY_ACTIVITIES.map((a) => a.id);
