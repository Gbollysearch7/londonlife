import { ORIGINS } from "@/content/character";
import { MISSIONS } from "@/content/world";
import type { MissionDef, OriginDef } from "@/content/types";
import { firstFreeSpot, placementError, type Placed } from "./placement";

/** Weighted origin pick. `r` is a uniform random number in [0, 1) supplied by the server. */
export function pickOrigin(r: number): OriginDef {
  const total = ORIGINS.reduce((s, o) => s + o.weight, 0);
  let t = r * total;
  for (const o of ORIGINS) {
    t -= o.weight;
    if (t < 0) return o;
  }
  return ORIGINS[ORIGINS.length - 1];
}

const PREFERRED: Record<string, [number, number, number]> = {
  single_bed: [0, 0, 0],
  double_bed: [0, 0, 0],
  desk: [1, 0, 0],
  bookshelf: [3, 0, 0],
  camp_hob: [4, 0, 0],
  cooker: [4, 0, 0],
  fridge: [5, 0, 0],
  storage_chest: [5, 2, 0],
  guitar: [0, 3, 0],
  sofa: [2, 3, 0],
  rug: [2, 3, 0],
  tv: [2, 5, 180],
  lamp: [5, 3, 0],
  shower: [0, 5, 0],
  toilet: [0, 4, 90],
};

/** Lays out a starter home: preferred authored spots first, then the first free valid cell. */
export function layoutStarterHome(defIds: string[], gridW: number, gridD: number): { defId: string; spot: Placed | null }[] {
  const placed: Placed[] = [];
  return defIds.map((defId, i) => {
    const pref = PREFERRED[defId];
    let spot: Placed | null = null;
    if (pref) {
      const c = { id: `s${i}`, defId, x: Math.min(pref[0], gridW - 1), y: Math.min(pref[1], gridD - 1), rot: pref[2] };
      if (!placementError(c, placed, gridW, gridD)) spot = c;
    }
    if (!spot) {
      const f = firstFreeSpot(defId, placed, gridW, gridD);
      spot = f ? { ...f, id: `s${i}` } : null;
    }
    if (spot) placed.push(spot);
    return { defId, spot };
  });
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const POOLS: MissionDef["pool"][] = ["Easy", "Explore", "Enterprise"];

/** One mission from each pool, deterministic per character and London day. */
export function assignMissions(characterId: string, dayKey: string): string[] {
  return POOLS.map((pool) => {
    const options = MISSIONS.filter((m) => m.pool === pool);
    return options[hash(`${characterId}:${dayKey}:${pool}`) % options.length].id;
  });
}

/** Replacement for a swapped mission: next option in the same pool not already assigned. */
export function swapMission(current: string[], missionId: string): string | null {
  const def = MISSIONS.find((m) => m.id === missionId);
  if (!def) return null;
  const options = MISSIONS.filter((m) => m.pool === def.pool && !current.includes(m.id));
  return options[0]?.id ?? null;
}

export interface EventRow {
  type: string;
  data: Record<string, string>;
}

export function missionProgress(def: MissionDef, events: EventRow[]): number {
  const n = events.filter(
    (e) => e.type === def.event && Object.entries(def.match ?? {}).every(([k, v]) => e.data?.[k] === v),
  ).length;
  return Math.min(def.target, n);
}
