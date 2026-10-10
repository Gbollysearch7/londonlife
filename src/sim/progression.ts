import { DECOR_MOOD_CAP, REPUTATION_TITLES, SKILL_THRESHOLDS } from "@/content/balance";
import { TRAITS } from "@/content/character";
import { furnitureDef } from "@/content/catalogue";
import { NEED_IDS, type Needs, type SkillId } from "@/content/types";

export function levelForXp(xp: number): number {
  let level = 0;
  for (let i = 0; i < SKILL_THRESHOLDS.length; i++) if (xp >= SKILL_THRESHOLDS[i]) level = i;
  return level;
}

export function skillProgress(xp: number) {
  const level = levelForXp(xp);
  const cur = SKILL_THRESHOLDS[level];
  const next = SKILL_THRESHOLDS[level + 1];
  return { level, xp, nextXp: next ?? null, progress: next ? (xp - cur) / (next - cur) : 1 };
}

/** XP after trait multipliers. Applied exactly once, on the server, at settlement. */
export function xpWithTraits(skill: SkillId, base: number, traits: string[]): number {
  let mult = 1;
  for (const t of traits) mult *= TRAITS.find((x) => x.id === t)?.xp?.[skill] ?? 1;
  return Math.round(base * mult);
}

export function reputation(xp: number) {
  let idx = 0;
  for (let i = 0; i < REPUTATION_TITLES.length; i++) if (xp >= REPUTATION_TITLES[i].xp) idx = i;
  const next = REPUTATION_TITLES[idx + 1];
  return { xp, level: idx + 1, title: REPUTATION_TITLES[idx].title, nextTitle: next?.title ?? null, nextXp: next?.xp ?? null };
}

export interface MoodFactor {
  label: string;
  value: number;
}

/** Mood = average of needs plus bounded modifiers. Duplicate decor definitions count once. */
export function computeMood(needs: Needs, placedDefIds: string[], weather: { moodDelta: number; label: string }) {
  const base = NEED_IDS.reduce((s, id) => s + needs[id], 0) / NEED_IDS.length;
  const factors: MoodFactor[] = [{ label: "Needs", value: Math.round(base) }];
  const uniqueDecor = new Set(placedDefIds);
  let decor = 0;
  for (const id of uniqueDecor) decor += furnitureDef(id)?.decor ?? 0;
  decor = Math.min(DECOR_MOOD_CAP, decor);
  if (decor) factors.push({ label: "Home décor", value: decor });
  if (weather.moodDelta) factors.push({ label: weather.label, value: weather.moodDelta });
  for (const id of NEED_IDS) if (needs[id] <= 10) factors.push({ label: `Very low ${id}`, value: -5 });
  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((s, f) => s + f.value, 0))));
  const label = score < 25 ? "Miserable" : score < 45 ? "Low" : score < 65 ? "Okay" : score < 80 ? "Good" : "Great";
  return { score, label, factors };
}

/** Authored stochastic forecast: deterministic per London day, never re-rolled per render. */
export function weatherFor(dayKey: string) {
  let h = 2166136261;
  for (const c of dayKey) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (h >>> 0) / 4294967295;
  if (r < 0.3) return { id: "rain", label: "Light rain", tempC: 11, moodDelta: -2 };
  if (r < 0.55) return { id: "cloud", label: "Overcast", tempC: 13, moodDelta: 0 };
  if (r < 0.8) return { id: "sun", label: "Sunny spells", tempC: 16, moodDelta: 2 };
  return { id: "drizzle", label: "Drizzle", tempC: 12, moodDelta: -1 };
}
