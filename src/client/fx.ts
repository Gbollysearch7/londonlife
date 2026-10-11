"use client";
import { create } from "zustand";
import { NEED_IDS } from "@/content/types";
import type { State } from "./api";

/**
 * Presentation-only feedback derived from two consecutive authoritative states: floating numbers,
 * celebration banners and sound cues. Nothing here changes game state; it only reacts to it.
 */
export type FloatKind = "need" | "money" | "xp" | "star" | "rep";

export interface FloatFx {
  id: number;
  text: string;
  colour: string;
  kind: FloatKind;
  /** Order within one burst, so several floats stack instead of overlapping. */
  slot: number;
  born: number;
}

export interface Celebration {
  id: number;
  title: string;
  sub: string;
  icon: string;
}

export type Cue = "coin" | "spend" | "xp" | "level" | "star" | "promote" | "arrive" | "done";

interface FxStore {
  floats: FloatFx[];
  celebrations: Celebration[];
  /** Until when (ms epoch) the avatar plays its celebrate pose. */
  celebrateUntil: number;
  push: (floats: Omit<FloatFx, "id" | "born" | "slot">[], celebrations: Omit<Celebration, "id">[]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useFx = create<FxStore>((set, get) => ({
  floats: [],
  celebrations: [],
  celebrateUntil: 0,
  push: (floats, celebrations) => {
    const now = Date.now();
    const born = floats.map((f, slot) => ({ ...f, id: nextId++, born: now, slot }));
    const cel = celebrations.map((c) => ({ ...c, id: nextId++ }));
    set({
      floats: [...get().floats.filter((f) => now - f.born < 4000), ...born].slice(-14),
      celebrations: [...get().celebrations, ...cel].slice(-3),
      celebrateUntil: cel.length ? now + 2600 : get().celebrateUntil,
    });
    if (born.length) setTimeout(() => set({ floats: get().floats.filter((f) => Date.now() - f.born < 3000) }), 3200);
  },
  dismiss: (id) => set({ celebrations: get().celebrations.filter((c) => c.id !== id) }),
}));

const NEED_NAMES: Record<string, string> = { hunger: "Hunger", energy: "Energy", fun: "Fun", social: "Social", hygiene: "Hygiene", bladder: "Bladder" };
const pounds = (p: number) => `£${(Math.abs(p) / 100).toFixed(2)}`;

export interface Diff {
  floats: Omit<FloatFx, "id" | "born" | "slot">[];
  celebrations: Omit<Celebration, "id">[];
  cues: Cue[];
}

/**
 * Compares the previous and next state of the same character. Need changes are only shown when
 * something settled (an activity, shift or command), so ordinary decay between refreshes stays quiet.
 */
export function diffStates(prev: State | null, next: State, settled: boolean): Diff {
  const out: Diff = { floats: [], celebrations: [], cues: [] };
  if (!prev || prev.character.id !== next.character.id) return out;

  const dm = next.wallet.cashPence - prev.wallet.cashPence;
  if (dm) {
    out.floats.push({ text: `${dm > 0 ? "+" : "−"}${pounds(dm)}`, colour: dm > 0 ? "#2f8a5f" : "#bc3d3b", kind: "money" });
    out.cues.push(dm > 0 ? "coin" : "spend");
  }

  if (settled) {
    for (const id of NEED_IDS) {
      const d = Math.round(next.needs[id] - prev.needs[id]);
      if (Math.abs(d) >= 2) out.floats.push({ text: `${NEED_NAMES[id]} ${d > 0 ? "+" : "−"}${Math.abs(d)}`, colour: d > 0 ? "#2f6355" : "#8f2c2a", kind: "need" });
    }
  }

  for (const s of next.skills) {
    const before = prev.skills.find((x) => x.id === s.id);
    if (!before) continue;
    const dx = s.xp - before.xp;
    if (dx > 0) {
      out.floats.push({ text: `+${dx} ${s.name} XP`, colour: "#a07a2c", kind: "xp" });
      if (!out.cues.includes("xp")) out.cues.push("xp");
    }
    if (s.level > before.level) {
      out.celebrations.push({ title: `${s.name} level ${s.level}!`, sub: s.level >= 10 ? "Maxed out. Legendary." : "New things unlock as your skills grow.", icon: "↑" });
      out.cues.push("level");
    }
  }

  const ds = next.character.stars - prev.character.stars;
  if (ds > 0) {
    out.floats.push({ text: `+${ds} ✦`, colour: "#c69c58", kind: "star" });
    out.cues.push("star");
  }

  const dr = next.character.reputation.xp - prev.character.reputation.xp;
  if (dr > 0) out.floats.push({ text: `+${dr} reputation`, colour: "#2f4a6b", kind: "rep" });
  if (next.character.reputation.level > prev.character.reputation.level) {
    out.celebrations.push({ title: `You're now ${next.character.reputation.title}`, sub: "Londoners are starting to know your name.", icon: "✦" });
    out.cues.push("level");
  }

  const pc = prev.career.current;
  const nc = next.career.current;
  if (pc && nc && pc.careerId === nc.careerId && (nc.rank > pc.rank || (nc.rank === pc.rank && nc.grade !== pc.grade && nc.salaryPence > pc.salaryPence))) {
    out.celebrations.push({ title: `Promoted: ${nc.title}`, sub: `Your pay is now £${(nc.salaryPence / 100).toFixed(2)} a shift.`, icon: "◆" });
    out.cues.push("promote");
  }

  if (prev.journey && !next.journey && next.character.location !== prev.character.location) out.cues.push("arrive");
  if (prev.activity && !next.activity && !out.cues.length) out.cues.push("done");
  return out;
}
