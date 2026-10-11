import type { NeedId, SkillId } from "./types";

/**
 * Goals and long-term progression (spec ch. 7 moodlets, ch. 20 streaks, wishes, perks, ambitions).
 * DESIGN DEFAULTS: fictional values, tuned so stars are earned at a steady pace and perks feel earned.
 */

// ───────────────────────────── daily check-in ─────────────────────────────

/** Seven-day cycle; missing a London day resets the streak to day 1. */
export const CHECKIN_REWARDS: { pence: number; stars: number; rep: number }[] = [
  { pence: 500, stars: 0, rep: 10 },
  { pence: 800, stars: 0, rep: 10 },
  { pence: 1000, stars: 1, rep: 12 },
  { pence: 1200, stars: 0, rep: 12 },
  { pence: 1500, stars: 1, rep: 15 },
  { pence: 1500, stars: 1, rep: 15 },
  { pence: 3000, stars: 2, rep: 25 },
];
export const checkinReward = (streak: number) => CHECKIN_REWARDS[(streak - 1) % CHECKIN_REWARDS.length];

// ───────────────────────────── wishes ─────────────────────────────

export interface WishDef {
  id: string;
  title: string;
  event: string;
  match?: Record<string, string>;
  target: number;
  stars: number;
}

/** Small personal goals; three a day, each pays stars once. */
export const WISHES: WishDef[] = [
  { id: "w_dance", title: "Dance somewhere", event: "practised", match: { skill: "dance" }, target: 1, stars: 1 },
  { id: "w_jog", title: "Go for a jog in the park", event: "practised", match: { activity: "park_jog" }, target: 1, stars: 1 },
  { id: "w_sunset", title: "Watch a sunset by the river", event: "relaxed", match: { activity: "watch_sunset" }, target: 1, stars: 2 },
  { id: "w_cook_two", title: "Cook two meals", event: "cooked", target: 2, stars: 1 },
  { id: "w_tube", title: "Ride the Tube", event: "journey_arrived", match: { mode: "tube" }, target: 1, stars: 1 },
  { id: "w_perform", title: "Perform for a crowd", event: "performed", target: 1, stars: 2 },
  { id: "w_quiz", title: "Play a pub quiz", event: "quiz_played", target: 1, stars: 1 },
  { id: "w_treasure", title: "Find today's treasure", event: "treasure_found", target: 1, stars: 2 },
  { id: "w_chat_two", title: "Chat with two locals", event: "npc_chat", target: 2, stars: 1 },
  { id: "w_read", title: "Read at the library", event: "practised", match: { activity: "library_coding" }, target: 1, stars: 1 },
  { id: "w_market", title: "Eat street food at the market", event: "meal_eaten", match: { activity: "market_street_food" }, target: 1, stars: 1 },
  { id: "w_gym", title: "Lift weights at the gym", event: "practised", match: { activity: "gym_weights" }, target: 1, stars: 1 },
  { id: "w_photo", title: "Take some photographs", event: "practised", match: { skill: "photography" }, target: 1, stars: 1 },
  { id: "w_story", title: "Finish a story", event: "story_completed", target: 1, stars: 2 },
  { id: "w_shift", title: "Work a full shift", event: "shift_completed", target: 1, stars: 1 },
  { id: "w_guitar", title: "Practise music", event: "practised", match: { skill: "music" }, target: 1, stars: 1 },
];
export const wishDef = (id: string) => WISHES.find((w) => w.id === id);
export const WISHES_PER_DAY = 3;

// ───────────────────────────── perks ─────────────────────────────

export type PerkEffect =
  | { kind: "decay"; need: NeedId; mult: number }
  | { kind: "xp"; mult: number }
  | { kind: "furniture_discount"; mult: number }
  | { kind: "sleep"; mult: number }
  | { kind: "work_perf"; mult: number }
  | { kind: "social_chance"; add: number }
  | { kind: "mood_duration"; mult: number };

export interface PerkDef {
  id: string;
  name: string;
  blurb: string;
  stars: number;
  effect: PerkEffect;
}

/** London perk shop. Costs follow the observed source table; names and icons are original. */
export const PERKS: PerkDef[] = [
  { id: "bladder_iron", name: "Iron Bladder", blurb: "Bladder drops 30% slower.", stars: 6, effect: { kind: "decay", need: "bladder", mult: 0.7 } },
  { id: "light_eater", name: "Light Eater", blurb: "Hunger drops 25% slower.", stars: 8, effect: { kind: "decay", need: "hunger", mult: 0.75 } },
  { id: "early_riser", name: "Early Riser", blurb: "Energy drops 25% slower.", stars: 8, effect: { kind: "decay", need: "energy", mult: 0.75 } },
  { id: "easily_amused", name: "Easily Amused", blurb: "Fun drops 25% slower.", stars: 8, effect: { kind: "decay", need: "fun", mult: 0.75 } },
  { id: "silver_tongue", name: "Silver Tongue", blurb: "+10% chance on Charisma checks in stories.", stars: 10, effect: { kind: "social_chance", add: 0.1 } },
  { id: "bargain_hunter", name: "Bargain Hunter", blurb: "10% off furniture.", stars: 10, effect: { kind: "furniture_discount", mult: 0.9 } },
  { id: "go_getter", name: "Go-Getter", blurb: "Performance gains at work +25%.", stars: 12, effect: { kind: "work_perf", mult: 1.25 } },
  { id: "quick_study", name: "Quick Study", blurb: "All skills grow 20% faster.", stars: 14, effect: { kind: "xp", mult: 1.2 } },
  { id: "fresh_as_a_daisy", name: "Fresh as a Daisy", blurb: "Hygiene drops 25% slower.", stars: 16, effect: { kind: "decay", need: "hygiene", mult: 0.75 } },
  { id: "social_butterfly", name: "Social Butterfly", blurb: "Social drops 25% slower.", stars: 16, effect: { kind: "decay", need: "social", mult: 0.75 } },
  { id: "deep_sleeper", name: "Deep Sleeper", blurb: "Sleep and naps restore 30% more energy.", stars: 18, effect: { kind: "sleep", mult: 1.3 } },
  { id: "sunny_side", name: "Sunny Side", blurb: "Good moods last 50% longer.", stars: 25, effect: { kind: "mood_duration", mult: 1.5 } },
];
export const perkDef = (id: string) => PERKS.find((p) => p.id === id);

/** Combined multipliers for a set of owned perks (applied once, to rates or amounts, never to stored values). */
export function perkEffects(owned: string[]) {
  const out = {
    decay: {} as Partial<Record<NeedId, number>>,
    xp: 1,
    furniture: 1,
    sleep: 1,
    workPerf: 1,
    socialChance: 0,
    moodDuration: 1,
  };
  for (const id of owned) {
    const e = perkDef(id)?.effect;
    if (!e) continue;
    if (e.kind === "decay") out.decay[e.need] = (out.decay[e.need] ?? 1) * e.mult;
    else if (e.kind === "xp") out.xp *= e.mult;
    else if (e.kind === "furniture_discount") out.furniture *= e.mult;
    else if (e.kind === "sleep") out.sleep *= e.mult;
    else if (e.kind === "work_perf") out.workPerf *= e.mult;
    else if (e.kind === "social_chance") out.socialChance += e.add;
    else if (e.kind === "mood_duration") out.moodDuration *= e.mult;
  }
  return out;
}

// ───────────────────────────── moodlets ─────────────────────────────

export interface MoodletDef {
  id: string;
  label: string;
  icon: string;
  strength: number;
  /** Real minutes before the moodlet fades (before any development time scale). */
  minutes: number;
}

export const MOODLETS: MoodletDef[] = [
  { id: "well_rested", label: "Well rested", icon: "☾", strength: 8, minutes: 240 },
  { id: "great_meal", label: "Great meal", icon: "◐", strength: 6, minutes: 120 },
  { id: "fresh", label: "Squeaky clean", icon: "◇", strength: 4, minutes: 120 },
  { id: "buzzing", label: "Buzzing after a performance", icon: "♪", strength: 10, minutes: 180 },
  { id: "endorphins", label: "Endorphins", icon: "↑", strength: 6, minutes: 150 },
  { id: "danced_out", label: "Danced it out", icon: "★", strength: 8, minutes: 180 },
  { id: "inspired", label: "Inspired", icon: "✎", strength: 5, minutes: 120 },
  { id: "sunset_glow", label: "Sunset glow", icon: "☀", strength: 10, minutes: 180 },
  { id: "lucky_find", label: "Lucky find", icon: "◆", strength: 8, minutes: 360 },
  { id: "story_high", label: "What a story", icon: "✦", strength: 8, minutes: 240 },
  { id: "good_company", label: "Good company", icon: "☺", strength: 5, minutes: 120 },
  { id: "party_host", label: "Hosted a great party", icon: "♫", strength: 10, minutes: 240 },
  { id: "soaked", label: "Soaked through", icon: "☂", strength: -6, minutes: 60 },
  { id: "embarrassed", label: "A bit embarrassed", icon: "…", strength: -4, minutes: 60 },
];
export const moodletDef = (id: string) => MOODLETS.find((m) => m.id === id);

/** Which moodlet a completed activity grants (by activity id, then by its event and skill). */
export function moodletForActivity(activityId: string, event: string, skill?: SkillId): string | null {
  const byId: Record<string, string> = {
    sleep: "well_rested",
    watch_sunset: "sunset_glow",
    jollof_rice: "great_meal",
    eat_jollof_rice: "great_meal",
    eat_chickpea_curry: "great_meal",
    eat_stuffed_peppers: "great_meal",
    curry_bowl: "great_meal",
    pub_lunch: "great_meal",
    market_street_food: "great_meal",
    shower: "fresh",
    gym_shower: "fresh",
    public_shower: "fresh",
    reading_group: "inspired",
    library_coding: "inspired",
    campus_tutorial: "inspired",
    watch_band: "good_company",
    watch_match: "good_company",
    salon_gossip: "good_company",
    outdoor_fitness: "endorphins",
    park_jog: "endorphins",
    gym_weights: "endorphins",
    gym_coaching: "endorphins",
    five_a_side: "endorphins",
  };
  if (byId[activityId]) return byId[activityId];
  if (event === "practised" && skill === "dance") return "danced_out";
  return null;
}

// ───────────────────────────── friendships with locals ─────────────────────────────

/** Friendship with an authored NPC grows with time spent together (chats and NPC-led activities). */
export const FRIEND_TIERS = [
  { points: 0, title: "Stranger" },
  { points: 3, title: "Acquaintance" },
  { points: 8, title: "Friend" },
  { points: 15, title: "Good friend" },
  { points: 25, title: "Best friend" },
];
export function friendTier(points: number) {
  let i = 0;
  for (let k = 0; k < FRIEND_TIERS.length; k++) if (points >= FRIEND_TIERS[k].points) i = k;
  const next = FRIEND_TIERS[i + 1];
  return { level: i, title: FRIEND_TIERS[i].title, next: next ? next.points : null };
}

// ───────────────────────────── ambition milestones ─────────────────────────────

/** Stars paid once at each quarter of an ambition. */
export const AMBITION_MILESTONES = [
  { at: 0.25, stars: 2 },
  { at: 0.5, stars: 3 },
  { at: 0.75, stars: 4 },
  { at: 1, stars: 8 },
];
