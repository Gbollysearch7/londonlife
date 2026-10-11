import { PLAYER_FRIEND_TIERS, VISIT_CAPACITY } from "./social";

/**
 * Relationships, households and invitations between real players (spec ch. 19).
 * DESIGN DEFAULTS: thresholds, durations and rewards are initial values to balance.
 * Everything here needs the other person's own acceptance; nothing is created by one button.
 */

/** Friendship points needed before either friend may ask the other to date: Good friend. */
export const DATE_MIN_POINTS = PLAYER_FRIEND_TIERS[2].points;
export const DATE_MIN_TITLE = PLAYER_FRIEND_TIERS[2].title;

/** Relationship value needed (while dating) before either may propose becoming partners. */
export const PARTNER_MIN_VALUE = 10;
/** Relationship value never goes above this. */
export const ROMANCE_MAX_VALUE = 100;
/** Extra relationship value for going to the other's party (once per party). */
export const ROMANCE_PARTY_BONUS = 3;

/** Romance requests last this many days before expiring. */
export const ROMANCE_REQUEST_DAYS = 3;
/** After a decline, the same person must wait this long before asking again. */
export const ROMANCE_REASK_DAYS = 3;

/**
 * DESIGN DEFAULT: one romance (dating or partnered) per person at a time. The source supported
 * up to four partners; London keeps it to one until the owner decides otherwise.
 */
export const MAX_ROMANCES = 1;

export function romanceStage(status: "dating" | "partnered", value: number) {
  if (status === "partnered") return value >= 60 ? "Devoted partners" : "Partners";
  return value >= PARTNER_MIN_VALUE ? "Going steady" : "Dating";
}

/** Friends must be at least this close (or dating/partnered) to share a household: Friend. */
export const HOUSEHOLD_MIN_POINTS = PLAYER_FRIEND_TIERS[1].points;
export const HOUSEHOLD_MIN_TITLE = PLAYER_FRIEND_TIERS[1].title;
/** Members besides the owner. */
export const HOUSEHOLD_MAX_MEMBERS = 3;
export const HOUSEHOLD_INVITE_DAYS = 3;

/**
 * What a household member may do in the owner's home, with their own groceries and energy:
 * cook, sleep or nap, shower and use the toilet. Never furniture, money, staff or messages.
 */
export const HOST_HOME_ACTIVITY = (id: string) => id.startsWith("cook_") || ["sleep", "nap", "shower", "toilet"].includes(id);

/** A visit invitation can be accepted for this many real minutes (shortened only by the dev time scale). */
export const VISIT_INVITE_MINUTES = 24 * 60;

/** A real-player party stays open this many real minutes after the host opens it. */
export const PLAYER_PARTY_MINUTES = 60;
/** Guests one party can hold, reserved atomically (the source showed a cap of eight). */
export const PARTY_GUEST_CAP = VISIT_CAPACITY;
/** What a guest gets the first time they join a given party. */
export const PARTY_GUEST_REWARD = { social: 20, fun: 15 };

/** Shown honestly in the Family app: these are not built. */
export const NOT_BUILT = [
  { name: "Children", why: "Not built — the parenting, consent and care-cost rules are still an open product decision." },
  { name: "Relatives (siblings, cousins, aunties and uncles)", why: "Not built yet." },
  { name: "Marriage", why: "Not built yet — partners is the closest tie for now." },
];
