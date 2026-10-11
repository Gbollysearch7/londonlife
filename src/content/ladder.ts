/**
 * Weekly table-games ladder (spec ch. 22, Hall of Fame): friendly only, no money, no prizes beyond a
 * cosmetic champion badge. Only games between two real players count; practice against an NPC never does.
 */
import { londonDayKey } from "@/sim/time";

export const LADDER = {
  points: { win: 3, draw: 1, loss: 0 },
  /** Each player must make at least this many moves of their own (not timed-out auto moves) for a game to count. */
  minOwnMoves: 3,
  /** At most this many games between the same two people count each week, so two friends can't farm the ladder. */
  pairGamesPerWeek: 3,
  /** Rows shown on each venue's board. */
  boardSize: 5,
  /** Past weeks shown in the Hall of Fame. */
  pastWeeks: 4,
} as const;

export const LADDER_RULES = [
  `Win ${LADDER.points.win} points, draw ${LADDER.points.draw}, against real players at a venue table. Practice games against the NPC never count.`,
  `A game counts when both players made at least ${LADDER.minOwnMoves} moves of their own. Up to ${LADDER.pairGamesPerWeek} games a week against the same person count.`,
  "Weeks run Monday to Sunday, London time. Most points tops the venue's board; ties go to more wins, then to whoever got there first.",
  "Friendly only: no stakes and no money prizes. Each week's champion at a venue earns a badge on their profile.",
] as const;

const DAY = 86_400_000;

/** The week a moment belongs to, keyed by the London date of its Monday ("2026-10-05"). DST-safe. */
export function ladderWeekKey(at: Date): string {
  const day = londonDayKey(at);
  const noon = new Date(`${day}T12:00:00Z`);
  const wd = noon.getUTCDay() || 7;
  return new Date(noon.getTime() - (wd - 1) * DAY).toISOString().slice(0, 10);
}

/** The week key `n` weeks before `key`. */
export function weeksBefore(key: string, n: number): string {
  return new Date(new Date(`${key}T12:00:00Z`).getTime() - n * 7 * DAY).toISOString().slice(0, 10);
}

export const weekLabel = (key: string) => `w/c ${new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;

export interface LadderEntry {
  characterId: string;
  points: number;
  wins: number;
  /** When the entry reached its total: an earlier finish wins a tie. */
  reachedAt: number;
}

/** Board order: points, then wins, then whoever reached their total first, then id for stability. */
export function rankLadder<T extends LadderEntry>(rows: T[]): T[] {
  return [...rows].sort((x, y) => y.points - x.points || y.wins - x.wins || x.reachedAt - y.reachedAt || (x.characterId < y.characterId ? -1 : 1));
}
