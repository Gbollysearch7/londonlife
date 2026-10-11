import type { ActivityDef, LocationId, VenueDef } from "./types";
import { londonDayKey, londonInstant, nextLondonWeekly } from "@/sim/time";

/**
 * CITY GOVERNMENT (spec ch. 25): a fictional weekly race for City Mayor of this game's London.
 * Policies are bounded game modifiers, not real politics. Nothing here is a real office or party.
 */

export type PolicyId = "status_quo" | "half_price_buses" | "free_gym_fridays" | "library_late_nights" | "market_rates_freeze";

export interface PolicyDef {
  id: PolicyId;
  name: string;
  summary: string;
}

export const POLICIES: PolicyDef[] = [
  { id: "status_quo", name: "Status quo", summary: "No change: the city carries on as it is." },
  { id: "half_price_buses", name: "Half-price buses", summary: "Every bus fare costs half as much for the whole term." },
  { id: "free_gym_fridays", name: "Free gym Fridays", summary: "Gym sessions and classes at Borough Athletics are free every Friday." },
  { id: "library_late_nights", name: "Library late nights", summary: "The Public Reading Library stays open until 23:00 instead of 20:00." },
  { id: "market_rates_freeze", name: "Market rates freeze", summary: "Stall rents are frozen, so groceries at Borough Street Market cost 20% less." },
];

/** Policies a candidate can stand on (the status quo is the caretaker's default, not a platform). */
export const PLATFORMS = POLICIES.filter((p) => p.id !== "status_quo");

export const policyDef = (id: string) => POLICIES.find((p) => p.id === id) ?? POLICIES[0];

export const ELECTION = {
  office: "City Mayor",
  /** Characters must be at least this old to stand or vote. */
  minAgeHours: 24,
  /** Voting closes Sunday 20:00 London time; the winner's policy runs until the next close. */
  closeWeekday: 7,
  closeHour: 20,
  /** Where ballots are cast, if that venue exists in this build; otherwise through the Government app anywhere. */
  pollingVenue: "city_hall",
  caretaker: "Caretaker Mayor (NPC)",
};

/** The Sunday close of the race open at `at` (strictly after it, so a ballot at 20:00 exactly is in next week's race). */
export const raceCloseAfter = (at: Date) => nextLondonWeekly(at, ELECTION.closeWeekday, ELECTION.closeHour);
/** Race id: the London date of its Sunday close, e.g. "2026-10-11". */
export const raceKeyAt = (at: Date) => londonDayKey(raceCloseAfter(at));
export const raceClose = (key: string) => londonInstant(key, ELECTION.closeHour);
/** The race that most recently closed at or before `at`; its winner governs now. */
export function previousRaceKey(at: Date) {
  const next = raceCloseAfter(at);
  return londonDayKey(raceCloseAfter(new Date(next.getTime() - 8 * 86_400_000)));
}

export interface Tally {
  candidateId: string;
  votes: number;
  stoodAt: Date;
}

/** Most votes wins; ties go to whoever stood first, then by id. No votes cast means the caretaker stays. */
export function pickWinner(rows: Tally[]): Tally | null {
  const sorted = [...rows].sort((x, y) => y.votes - x.votes || x.stoodAt.getTime() - y.stoodAt.getTime() || (x.candidateId < y.candidateId ? -1 : 1));
  return sorted[0] && sorted[0].votes > 0 ? sorted[0] : null;
}

// ─────────────────────────── policy effects (pure hooks) ───────────────────────────

/** Bus fare relief. */
export function policyQuote<T extends { mode: string; farePence: number }>(policy: PolicyId, q: T): T {
  return policy === "half_price_buses" && q.mode === "bus" ? { ...q, farePence: Math.floor(q.farePence / 2) } : q;
}

export const FREE_GYM_ACTIVITIES = ["gym_weights", "gym_treadmill", "gym_yoga", "gym_coaching"];

const isLondonFriday = (at: Date) => new Date(`${londonDayKey(at)}T12:00:00Z`).getUTCDay() === 5;

/** What an activity costs today under the current policy. */
export function policyActivityCost(policy: PolicyId, def: Pick<ActivityDef, "id" | "costPence">, at: Date): number {
  if (policy === "free_gym_fridays" && FREE_GYM_ACTIVITIES.includes(def.id) && isLondonFriday(at)) return 0;
  return def.costPence;
}

/** A venue as it operates under the current policy (opening hours). */
export function policyVenue<V extends Pick<VenueDef, "id" | "hours">>(policy: PolicyId, v: V): V;
export function policyVenue<V extends Pick<VenueDef, "id" | "hours">>(policy: PolicyId, v: V | undefined): V | undefined;
export function policyVenue<V extends Pick<VenueDef, "id" | "hours">>(policy: PolicyId, v: V | undefined): V | undefined {
  if (v && policy === "library_late_nights" && v.id === "reading_library") return { ...v, hours: [9, 23] as [number, number], ...("opening" in v ? { opening: "09:00–23:00 (late nights)" } : {}) };
  return v;
}

/** Grocery unit price under the current policy. */
export function policyGroceryPrice(policy: PolicyId, location: LocationId | string, pricePence: number): number {
  return policy === "market_rates_freeze" && location === "borough_market" ? Math.round(pricePence * 0.8) : pricePence;
}
