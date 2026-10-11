import {
  DECAY_PER_HOUR,
  NEWCOMER_FLOOR,
  NEWCOMER_GRACE_HOURS,
  OFFLINE_CAP_HOURS,
} from "@/content/balance";
import { TRAITS } from "@/content/character";
import { NEED_IDS, type NeedId, type Needs } from "@/content/types";

export const clampNeed = (v: number) => Math.min(100, Math.max(0, v));

/** Decay rate per hour for a character, after trait multipliers (applied once, server-side). */
export function decayRates(traitIds: string[], perkDecay: Partial<Record<NeedId, number>> = {}): Record<NeedId, number> {
  const rates = { ...DECAY_PER_HOUR };
  for (const [need, mult] of Object.entries(perkDecay)) rates[need as NeedId] *= mult!;
  for (const t of traitIds) {
    const def = TRAITS.find((x) => x.id === t);
    for (const [need, mult] of Object.entries(def?.decay ?? {})) rates[need as NeedId] *= mult!;
  }
  return rates;
}

export interface SettleInput {
  needs: Needs;
  settledAt: Date;
  now: Date;
  traits: string[];
  createdAt: Date;
  /** Perk multipliers on decay rates (applied once, to rates). */
  perkDecay?: Partial<Record<NeedId, number>>;
}

export interface SettleResult {
  needs: Needs;
  /** Elapsed hours actually applied (after the offline cap). */
  appliedHours: number;
  capped: boolean;
}

/**
 * Settles baseline decay from `settledAt` to `now`.
 * Order: elapsed → offline cap → trait-adjusted rates → newcomer floor → clamp.
 * Callers store the result with `now` as the new settlement time, so no interval is applied twice.
 */
export function settleNeeds({ needs, settledAt, now, traits, createdAt, perkDecay }: SettleInput): SettleResult {
  const elapsedHours = Math.max(0, (now.getTime() - settledAt.getTime()) / 3_600_000);
  const appliedHours = Math.min(elapsedHours, OFFLINE_CAP_HOURS);
  const rates = decayRates(traits, perkDecay);
  const inGrace = now.getTime() - createdAt.getTime() < NEWCOMER_GRACE_HOURS * 3_600_000;
  const next = { ...needs };
  for (const id of NEED_IDS) {
    let v = needs[id] - rates[id] * appliedHours;
    if (inGrace && needs[id] >= NEWCOMER_FLOOR) v = Math.max(v, NEWCOMER_FLOOR);
    next[id] = clampNeed(v);
  }
  return { needs: next, appliedHours, capped: elapsedHours > OFFLINE_CAP_HOURS };
}

export function applyEffects(needs: Needs, effects: Partial<Needs>, multiplier: Partial<Record<NeedId, number>> = {}): Needs {
  const next = { ...needs };
  for (const [id, delta] of Object.entries(effects) as [NeedId, number][]) {
    next[id] = clampNeed(next[id] + delta * (delta > 0 ? multiplier[id] ?? 1 : 1));
  }
  return next;
}

export const NEED_LABELS: Record<NeedId, string> = {
  hunger: "Hunger",
  energy: "Energy",
  fun: "Fun",
  social: "Social",
  hygiene: "Hygiene",
  bladder: "Bladder",
};

export const NEED_CONSEQUENCES: Record<NeedId, string> = {
  hunger: "Too hungry to take paid tasks below 15.",
  energy: "Strenuous tasks are blocked below 15.",
  fun: "Low fun drags your mood down.",
  social: "Lonely: mood suffers.",
  hygiene: "Poor hygiene lowers mood.",
  bladder: "At zero you'll have an accident and lose hygiene.",
};

export const NEED_RECOVERY: Record<NeedId, string> = {
  hunger: "Eat a meal at home or the Food Hall; the Common Room serves a free meal daily.",
  energy: "Sleep or nap at home, or rest on the Common Room sofa. If you're run down, the Borough Health Centre can help for free.",
  fun: "Watch TV, put your feet up, or practise a hobby.",
  social: "Chat with Nia or Bev, or volunteer at the Common Room.",
  hygiene: "Shower at home, or use the free shower at the Common Room.",
  bladder: "Use a toilet at home or at any venue.",
};
