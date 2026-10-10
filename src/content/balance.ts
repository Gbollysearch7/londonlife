import type { NeedId } from "./types";

/**
 * DESIGN DEFAULTS (spec ch. 31) — fictional game values, not real London prices.
 * Change as a versioned table; never inline in UI handlers.
 */
export const CONTENT_VERSION = 1;

export const START_NEEDS = 80;

/** Awake baseline decay, points per real hour. */
export const DECAY_PER_HOUR: Record<NeedId, number> = {
  hunger: 6,
  energy: 4,
  fun: 3,
  social: 2,
  hygiene: 3,
  bladder: 8,
};

/** A single settlement never applies more than this much elapsed time. */
export const OFFLINE_CAP_HOURS = 8;

/** During the first calendar day, decay cannot push a need below this floor. */
export const NEWCOMER_GRACE_HOURS = 24;
export const NEWCOMER_FLOOR = 25;

export const URGENT_THRESHOLD = 20;

/** Cumulative XP needed for levels 0–10. */
export const SKILL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3250, 4200];

export const REPUTATION_TITLES = [
  { xp: 0, title: "New Arrival" },
  { xp: 100, title: "Local" },
  { xp: 300, title: "Familiar Face" },
  { xp: 700, title: "Borough Favourite" },
  { xp: 1500, title: "City Insider" },
  { xp: 3000, title: "London Legend" },
];

/** Furniture resale as a fraction of the price paid. */
export const RESALE_FRACTION = 0.5;

/** Maximum mood points that decor can add, however many items are placed. */
export const DECOR_MOOD_CAP = 6;

export const DAILY_MISSION_SWAPS = 1;
export const ALL_MISSIONS_BONUS = { pence: 1500, rep: 80, stars: 2 };

/** One-time star reward for the first care action of the tour. */
export const FIRST_CARE_STARS = 1;
