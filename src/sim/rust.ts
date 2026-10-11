import { levelForXp } from "./progression";

/**
 * Skill rust (spec ch. 9, 31). LONDON DESIGN DEFAULT for the source-described rule:
 * - a skill unused for up to 7 days keeps its full level (grace);
 * - after that, the effective level drops by 1 for every 20 further unused days (day 27 → −1, day 47 → −2);
 * - it never drops more than 2 levels below the personal best, nor below 0;
 * - XP is never deleted: practising once (any XP gain) restores the full level immediately.
 * Rust is a pure function of stored XP, best level and last-used time, so it is never applied twice.
 */
export const RUST = { graceDays: 7, daysPerLevel: 20, maxDrop: 2 };

const DAY_MS = 86_400_000;

export interface SkillRecord {
  xp: number;
  bestLevel: number;
  /** When XP was last earned; null for head-start levels never practised (the character's creation time is used). */
  lastUsedAt: Date | null;
}

export interface RustInfo {
  /** Level earned from XP (never goes down). */
  level: number;
  /** Personal best level. */
  best: number;
  /** Level used for every gate and skill check. */
  effective: number;
  /** Levels currently lost to rust (0–2). */
  drop: number;
  /** When the next level of rust sets in, or null when it can't drop further. */
  nextDropAt: string | null;
}

export function rustInfo(r: SkillRecord, now: Date, createdAt: Date): RustInfo {
  const level = levelForXp(r.xp);
  const best = Math.max(level, r.bestLevel);
  const since = (r.lastUsedAt ?? createdAt).getTime();
  const idleDays = Math.max(0, (now.getTime() - since) / DAY_MS);
  const steps = idleDays <= RUST.graceDays ? 0 : Math.floor((idleDays - RUST.graceDays) / RUST.daysPerLevel);
  const floor = Math.max(0, best - RUST.maxDrop);
  const effective = Math.max(0, Math.min(level, Math.max(level - steps, floor)));
  const drop = level - effective;
  const canDropMore = effective > floor && effective > 0;
  const nextDropAt = canDropMore ? new Date(since + (RUST.graceDays + RUST.daysPerLevel * (steps + 1)) * DAY_MS).toISOString() : null;
  return { level, best, effective, drop, nextDropAt };
}

export const effectiveLevel = (r: SkillRecord, now: Date, createdAt: Date) => rustInfo(r, now, createdAt).effective;
