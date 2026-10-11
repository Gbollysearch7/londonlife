import { OUTAGE, OUTAGE_KINDS, type OutageKind } from "@/content/household";
import { londonHour } from "./time";
import { londonWeekKey, londonWeekday, seededRandom } from "./shift";

export interface Outage {
  kind: OutageKind;
  /** ISO weekday (1 = Monday) in London. */
  weekday: number;
  /** London hours [start, end). */
  startHour: number;
  endHour: number;
}

/** This week's outage for a character, or null. Deterministic: the same week always gives the same answer. */
export function outageForWeek(charId: string, weekKey: string): Outage | null {
  const rand = seededRandom(`outage:${charId}:${weekKey}`);
  if (rand() >= OUTAGE.weeklyChance) return null;
  const kinds = Object.keys(OUTAGE_KINDS) as OutageKind[];
  const kind = kinds[Math.floor(rand() * kinds.length)];
  const weekday = 1 + Math.floor(rand() * 7);
  const [lo, hi] = OUTAGE.startHours;
  const startHour = lo + Math.floor(rand() * (hi - lo + 1));
  return { kind, weekday, startHour, endHour: startHour + OUTAGE.hours };
}

export function weekOutage(charId: string, now: Date): Outage | null {
  return outageForWeek(charId, londonWeekKey(now));
}

/** The outage in effect right now, or null. */
export function activeOutage(charId: string, now: Date): Outage | null {
  const o = weekOutage(charId, now);
  if (!o || londonWeekday(now) !== o.weekday) return null;
  const h = londonHour(now);
  return h >= o.startHour && h < o.endHour ? o : null;
}

/** Whether a home furniture tag (e.g. "shower") is out of action right now. */
export function outageBlocks(charId: string, now: Date, tag: string): Outage | null {
  const o = activeOutage(charId, now);
  return o && (OUTAGE_KINDS[o.kind].blocks as readonly string[]).includes(tag) ? o : null;
}
