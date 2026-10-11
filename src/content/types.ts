export const NEED_IDS = ["hunger", "energy", "fun", "social", "hygiene", "bladder"] as const;
export type NeedId = (typeof NEED_IDS)[number];
export type Needs = Record<NeedId, number>;

export const SKILL_IDS = [
  "cooking",
  "charisma",
  "fitness",
  "coding",
  "music",
  "enterprise",
  "dance",
  "comedy",
  "photography",
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export type LocationId =
  | "home"
  | "food_hall"
  | "common_room"
  | "city_office"
  | "camden_backroom"
  | "regents_green"
  | "reading_library"
  | "learning_campus"
  | "east_yard"
  | "last_stop_pub"
  | "afterlight"
  | "south_bank"
  | "borough_market"
  | "borough_athletics"
  | "crown_and_curl";

export interface TraitDef {
  id: string;
  name: string;
  blurb: string;
  /** Multipliers applied to baseline decay rates (1 = unchanged). */
  decay?: Partial<Record<NeedId, number>>;
  /** Multipliers applied to XP earned in a skill. */
  xp?: Partial<Record<SkillId, number>>;
  /** Trait ids that cannot be combined with this one. */
  conflicts?: string[];
}

export interface AmbitionDef {
  id: string;
  name: string;
  blurb: string;
}

export interface OriginDef {
  id: string;
  name: string;
  story: string;
  weight: number;
  cashPence: number;
  homeTier: string;
  furniture: string[];
  groceries: Record<string, number>;
  skills: Partial<Record<SkillId, number>>;
  perks: string[];
}

export interface HomeTierDef {
  id: string;
  name: string;
  gridW: number;
  gridD: number;
  district: string;
}

export type Surface = "floor" | "overlay" | "wall";

export interface FurnitureDef {
  id: string;
  name: string;
  category: "Sleep" | "Kitchen" | "Bath" | "Comfort" | "Fun" | "Skills" | "Light" | "Decor";
  pricePence: number;
  /** Footprint at rotation 0: w along x, d along y. */
  w: number;
  d: number;
  surface: Surface;
  quality: number;
  colours: string[];
  /** Activity tags this furniture enables at home. */
  enables: string[];
  /** Capped decor mood contribution; copies of the same definition count once. */
  decor?: number;
  blurb: string;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: "grocery" | "meal";
  pricePence?: number;
  unit?: string;
  /** Meal effects when eaten. */
  eat?: Partial<Needs>;
}

export interface RecipeDef {
  id: string;
  name: string;
  ingredients: Record<string, number>;
  makes: string;
  minutes: number;
  xp: number;
  cookingLevel: number;
}

export interface ActivityDef {
  id: string;
  label: string;
  description: string;
  location: LocationId;
  /** Furniture tag required in the home (home activities only). */
  requires?: string;
  minutes: number;
  costPence: number;
  consumes?: Record<string, number>;
  produces?: Record<string, number>;
  needs: Partial<Needs>;
  xp?: { skill: SkillId; amount: number };
  payPence?: number;
  skillGate?: { skill: SkillId; level: number };
  /** Maximum completions (plus running) per London calendar day. */
  dailyLimit?: number;
  /** Pays/rewards only once per character, ever. */
  once?: boolean;
  /** Real minutes before the same activity can start again. */
  cooldownMin?: number;
  /** Blocks the action when energy is below this value. */
  minEnergy?: number;
  minHunger?: number;
  cancelRule: string;
  /** Event emitted on completion (drives missions and tutorial). */
  event: string;
  eventData?: Record<string, string>;
  npc?: string;
  anchor?: string;
  /** London hours [from, to) when this can start; `to` may exceed 24 for after midnight. */
  hours?: [number, number];
  /** Which minigame runs instead of a plain timer (see content/minigames). */
  minigame?: "quiz" | "rhythm";
}

export interface VenueDef {
  id: LocationId;
  name: string;
  district: string;
  kind: "home" | "venue";
  blurb: string;
  opening: string;
  access: string;
  npcs: { id: string; name: string; role: string }[];
  street: { x: number };
  /** Position on the compressed city map (units ≈ km; x east, y south). Home uses the home district. */
  map?: [number, number];
  /** Opening hours [open, close) in London time; close may exceed 24. Omitted = always open. */
  hours?: [number, number];
  /** Short tags for map filters and the directory. */
  tags?: string[];
}

export interface MissionDef {
  id: string;
  pool: "Easy" | "Explore" | "Enterprise";
  title: string;
  event: string;
  match?: Record<string, string>;
  target: number;
  reward: { pence: number; rep: number; stars?: number };
}

export interface RankDef {
  title: string;
  /** Extra requirement to be promoted into this rank. */
  gate?: { skill: SkillId; level: number };
}

export interface CareerDef {
  id: string;
  name: string;
  blurb: string;
  workplace: LocationId;
  skill: SkillId;
  /** Entry requirement: any one of these skill levels. */
  entry?: { skill: SkillId; level: number }[];
  /** Pay multiplier against the base rank table. */
  multiplier: number;
  ranks: [RankDef, RankDef, RankDef, RankDef, RankDef];
  /** ISO weekdays (1 = Monday … 7 = Sunday) when shifts can start. */
  workdays: number[];
  /** London-time hours within which a shift may start: [from, to). */
  window: [number, number];
  tasks: string;
}

export interface WorkTaskDef {
  id: string;
  prompt: string;
  /** Exactly three options; outcome is fixed per option. */
  options: { text: string; outcome: "success" | "ok" | "fail" }[];
}
