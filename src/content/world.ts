import { ITEMS, RECIPES } from "./catalogue";
import type { ActivityDef, LocationId, MissionDef, VenueDef } from "./types";

export const VENUES: VenueDef[] = [
  {
    id: "home",
    name: "Home",
    district: "Camden",
    kind: "home",
    blurb: "Your place on Pratt Row.",
    opening: "Always",
    access: "Yours",
    npcs: [],
    street: { x: -14 },
  },
  {
    id: "food_hall",
    name: "Common Table Food Hall",
    district: "Camden",
    kind: "venue",
    blurb: "Affordable plates, shared tables and a busy open kitchen. Groceries at the counter.",
    opening: "Open daily",
    access: "Free entry",
    npcs: [{ id: "nia", name: "Nia", role: "Head cook (NPC)" }],
    street: { x: 2 },
  },
  {
    id: "common_room",
    name: "The Common Room",
    district: "Camden",
    kind: "venue",
    blurb: "A community centre with a noticeboard, a shared kitchen and a games corner. Free help when money is tight.",
    opening: "Open daily",
    access: "Free entry",
    npcs: [{ id: "bev", name: "Bev", role: "Centre coordinator (NPC)" }],
    street: { x: 16 },
  },
  {
    id: "city_office",
    name: "The City Office",
    district: "City",
    kind: "venue",
    blurb: "A glass office tower with a fintech start-up upstairs and a bank branch on the ground floor. Workplace for Technology, Banking and Product careers.",
    opening: "Weekdays",
    access: "Staff entrance",
    npcs: [{ id: "priya", name: "Priya", role: "Office manager (NPC)" }],
    street: { x: 34 },
  },
];

export const venue = (id: string) => VENUES.find((v) => v.id === id);

/** Walking minutes between places in the Camden slice. */
const WALK: Record<string, number> = {
  "home|food_hall": 6,
  "home|common_room": 8,
  "food_hall|common_room": 4,
  "home|city_office": 35,
  "food_hall|city_office": 30,
  "common_room|city_office": 28,
};

export const TRAVEL_MODES = {
  walk: { name: "Walk", farePence: 0, speed: 1, minMinutes: 1 },
  bus: { name: "Bus", farePence: 200, speed: 0.4, minMinutes: 2 },
  tube: { name: "Tube", farePence: 280, speed: 0.3, minMinutes: 4 },
} as const;
export type TravelMode = keyof typeof TRAVEL_MODES;

export function walkMinutes(a: LocationId, b: LocationId): number {
  return WALK[`${a}|${b}`] ?? WALK[`${b}|${a}`] ?? 0;
}

/** The Tube only serves trips between districts; short hops are walk or bus. */
export function modesFor(a: LocationId, b: LocationId): TravelMode[] {
  return walkMinutes(a, b) >= 20 ? ["walk", "bus", "tube"] : ["walk", "bus"];
}

export function journeyQuote(a: LocationId, b: LocationId, mode: TravelMode) {
  const m = TRAVEL_MODES[mode];
  const minutes = Math.max(m.minMinutes, Math.round(walkMinutes(a, b) * m.speed));
  return { mode, name: m.name, farePence: m.farePence, minutes };
}

const NO_REFUND = "Cancelling ends the activity with no reward; costs already paid are not refunded.";

const cookActivities: ActivityDef[] = RECIPES.map((r) => ({
  id: `cook_${r.id}`,
  label: `Cook ${r.name.toLowerCase()}`,
  description: `Makes one ${r.name.toLowerCase()} to eat later.`,
  location: "home",
  requires: "hob",
  minutes: r.minutes,
  costPence: 0,
  consumes: r.ingredients,
  produces: { [r.makes]: 1 },
  needs: {},
  xp: { skill: "cooking", amount: r.xp },
  skillGate: r.cookingLevel > 0 ? { skill: "cooking", level: r.cookingLevel } : undefined,
  cancelRule: "Ingredients are used as soon as you start and are not returned if you cancel.",
  event: "cooked",
  anchor: "hob",
}));

const eatActivities: ActivityDef[] = ITEMS.filter((i) => i.kind === "meal").map((m) => ({
  id: `eat_${m.id}`,
  label: `Eat ${m.name.toLowerCase()}`,
  description: "Eat a meal you made.",
  location: "home",
  minutes: 2,
  costPence: 0,
  consumes: { [m.id]: 1 },
  needs: { ...m.eat, bladder: -3 },
  cancelRule: "The meal is eaten once you start; cancelling gives no effect.",
  event: "meal_eaten",
}));

export const ACTIVITIES: ActivityDef[] = [
  // ── Home ──
  { id: "sleep", label: "Sleep", description: "A proper rest.", location: "home", requires: "bed", minutes: 20, costPence: 0, needs: { energy: 55, hunger: -4 }, cancelRule: "Cancelling wakes you with no energy gained.", event: "slept", anchor: "bed" },
  { id: "nap", label: "Nap", description: "A short lie-down on a bed or sofa.", location: "home", requires: "nap", minutes: 10, costPence: 0, needs: { energy: 25 }, cancelRule: "Cancelling gives no energy.", event: "napped", anchor: "bed" },
  { id: "shower", label: "Shower", description: "Freshen up.", location: "home", requires: "shower", minutes: 3, costPence: 0, needs: { hygiene: 45, energy: 3 }, cancelRule: NO_REFUND, event: "washed", anchor: "shower" },
  { id: "toilet", label: "Use the toilet", description: "", location: "home", requires: "toilet", minutes: 1, costPence: 0, needs: { bladder: 65 }, cancelRule: NO_REFUND, event: "toilet", anchor: "toilet" },
  { id: "snack", label: "Grab a snack", description: "A snack bar from the fridge.", location: "home", requires: "fridge", minutes: 1, costPence: 0, consumes: { snack_bar: 1 }, needs: { hunger: 12, fun: 2 }, cancelRule: "The snack is used once you start.", event: "meal_eaten", anchor: "fridge" },
  ...cookActivities,
  ...eatActivities,
  { id: "watch_tv", label: "Watch TV", description: "Catch up on a fictional soap.", location: "home", requires: "tv", minutes: 8, costPence: 0, needs: { fun: 25, energy: -2 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "tv" },
  { id: "relax", label: "Put your feet up", description: "Sit down and unwind.", location: "home", requires: "seat", minutes: 6, costPence: 0, needs: { fun: 10, energy: 5 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "seat" },
  { id: "read_cookbook", label: "Read a cookbook", description: "Trains Cooking.", location: "home", requires: "books", minutes: 10, costPence: 0, needs: { fun: 6 }, xp: { skill: "cooking", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "cooking" }, anchor: "books" },
  { id: "read_coding_book", label: "Read a coding book", description: "Trains Coding.", location: "home", requires: "books", minutes: 10, costPence: 0, needs: { fun: 6 }, xp: { skill: "coding", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "coding" }, anchor: "books" },
  { id: "coding_sprint_home", label: "Coding sprint", description: "Build something at your desk.", location: "home", requires: "desk", minutes: 10, costPence: 0, needs: { energy: -4 }, xp: { skill: "coding", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "coding" }, anchor: "desk" },
  { id: "practise_guitar", label: "Practise guitar", description: "Trains Music.", location: "home", requires: "guitar", minutes: 10, costPence: 0, needs: { fun: 12 }, xp: { skill: "music", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "music" }, anchor: "guitar" },
  { id: "home_workout", label: "Home workout", description: "Trains Fitness.", location: "home", requires: "weights", minutes: 10, costPence: 0, needs: { energy: -10, hygiene: -8, fun: 6 }, xp: { skill: "fitness", amount: 20 }, minEnergy: 15, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "fitness" }, anchor: "weights" },

  // ── Common Table Food Hall ──
  { id: "plate_of_the_day", label: "Plate of the day", description: "Today's plate from the open kitchen.", location: "food_hall", minutes: 2, costPence: 500, needs: { hunger: 30, energy: 2, bladder: -3 }, cancelRule: "You pay at the counter; cancelling does not refund the plate.", event: "meal_eaten", anchor: "table" },
  { id: "curry_bowl", label: "Vegetable curry bowl", description: "A generous bowl with rice.", location: "food_hall", minutes: 3, costPence: 700, needs: { hunger: 42, fun: 5, bladder: -3 }, cancelRule: "You pay at the counter; cancelling does not refund the bowl.", event: "meal_eaten", anchor: "table" },
  { id: "serve_shift", label: "Help serve the lunch rush", description: "Side task: clear tables and serve plates.", location: "food_hall", minutes: 5, costPence: 0, payPence: 1500, needs: { energy: -4, social: 4 }, xp: { skill: "enterprise", amount: 6 }, dailyLimit: 3, minEnergy: 15, minHunger: 15, cancelRule: "Leaving before the end pays nothing.", event: "side_task_paid", anchor: "counter" },
  { id: "cooking_demo", label: "Watch Nia's cooking demo", description: "Learn technique from the head cook.", location: "food_hall", minutes: 10, costPence: 300, needs: { fun: 6, social: 6 }, xp: { skill: "cooking", amount: 20 }, cancelRule: "The £3 demo fee is not refunded if you leave early.", event: "practised", eventData: { skill: "cooking" }, npc: "nia", anchor: "counter" },
  { id: "chat_nia", label: "Chat with Nia", description: "Nia is an NPC: a named local character, not another player.", location: "food_hall", minutes: 2, costPence: 0, needs: { social: 12 }, xp: { skill: "charisma", amount: 4 }, cooldownMin: 30, cancelRule: NO_REFUND, event: "npc_chat", eventData: { npc: "nia" }, npc: "nia", anchor: "counter" },
  { id: "food_hall_toilet", label: "Use the toilets", description: "Customer toilets.", location: "food_hall", minutes: 1, costPence: 0, needs: { bladder: 65 }, cancelRule: NO_REFUND, event: "toilet", anchor: "wc" },

  // ── The Common Room ──
  { id: "community_lunch_setup", label: "Help Bev set up community lunch", description: "Your first paid task in London: £20, paid once.", location: "common_room", minutes: 5, costPence: 0, payPence: 2000, needs: { social: 8, energy: -3 }, xp: { skill: "enterprise", amount: 6 }, once: true, cancelRule: "Leaving early pays nothing; you can start again.", event: "side_task_paid", npc: "bev", anchor: "kitchen" },
  { id: "community_meal", label: "Free community meal", description: "Once a day, no questions asked.", location: "common_room", minutes: 3, costPence: 0, needs: { hunger: 25, social: 6, bladder: -3 }, dailyLimit: 1, cancelRule: "Cancelling uses today's free meal.", event: "meal_eaten", anchor: "games" },
  { id: "chat_bev", label: "Chat with Bev", description: "Bev is an NPC: a named local character, not another player.", location: "common_room", minutes: 2, costPence: 0, needs: { social: 12 }, xp: { skill: "charisma", amount: 4 }, cooldownMin: 30, cancelRule: NO_REFUND, event: "npc_chat", eventData: { npc: "bev" }, npc: "bev", anchor: "board" },
  { id: "volunteer", label: "Volunteer at the centre", description: "Sort donations and meet neighbours.", location: "common_room", minutes: 10, costPence: 0, needs: { social: 15, fun: 5, energy: -5 }, xp: { skill: "charisma", amount: 10 }, minEnergy: 15, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "charisma" }, anchor: "kitchen" },
  { id: "coding_club", label: "Coding club", description: "Free session on the centre's computers.", location: "common_room", minutes: 10, costPence: 0, needs: { energy: -4, social: 4 }, xp: { skill: "coding", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "coding" }, anchor: "computers" },
  { id: "public_shower", label: "Use the centre shower", description: "Free shower for anyone who needs it.", location: "common_room", minutes: 3, costPence: 0, needs: { hygiene: 40 }, cancelRule: NO_REFUND, event: "washed", anchor: "shower" },
  { id: "common_room_toilet", label: "Use the toilets", description: "", location: "common_room", minutes: 1, costPence: 0, needs: { bladder: 65 }, cancelRule: NO_REFUND, event: "toilet", anchor: "wc" },
  { id: "office_coffee", label: "Coffee in the break kitchen", description: "Free filter coffee for staff.", location: "city_office", minutes: 2, costPence: 0, needs: { energy: 8, bladder: -6 }, cooldownMin: 45, cancelRule: NO_REFUND, event: "relaxed", anchor: "kitchen" },
  { id: "chat_priya", label: "Chat with Priya", description: "Priya is an NPC: a named local character, not another player.", location: "city_office", minutes: 2, costPence: 0, needs: { social: 12 }, xp: { skill: "charisma", amount: 4 }, cooldownMin: 30, cancelRule: NO_REFUND, event: "npc_chat", eventData: { npc: "priya" }, npc: "priya", anchor: "reception" },
  { id: "office_toilet", label: "Use the toilets", description: "", location: "city_office", minutes: 1, costPence: 0, needs: { bladder: 65 }, cancelRule: NO_REFUND, event: "toilet", anchor: "wc" },
  { id: "rest_sofa", label: "Rest on the old sofa", description: "Free, if a little lumpy.", location: "common_room", minutes: 10, costPence: 0, needs: { energy: 18 }, cancelRule: NO_REFUND, event: "napped", anchor: "sofa" },
];

export const activityDef = (id: string) => ACTIVITIES.find((a) => a.id === id);

/** Groceries sold at the Food Hall counter. */
export const GROCERY_SHOP: { location: LocationId; items: string[] } = {
  location: "food_hall",
  items: ["bread", "beans", "pasta", "tomato", "tea", "eggs", "rice", "plantain", "snack_bar"],
};

export const MISSIONS: MissionDef[] = [
  { id: "cook_once", pool: "Easy", title: "Cook a meal at home", event: "cooked", target: 1, reward: { pence: 300, rep: 20 } },
  { id: "freshen_up", pool: "Easy", title: "Have a shower", event: "washed", target: 1, reward: { pence: 200, rep: 10 } },
  { id: "eat_twice", pool: "Easy", title: "Eat two meals", event: "meal_eaten", target: 2, reward: { pence: 200, rep: 15 } },
  { id: "bus_twice", pool: "Explore", title: "Take the bus twice", event: "journey_arrived", match: { mode: "bus" }, target: 2, reward: { pence: 600, rep: 35 } },
  { id: "visit_food_hall", pool: "Explore", title: "Visit Common Table Food Hall", event: "journey_arrived", match: { destination: "food_hall" }, target: 1, reward: { pence: 300, rep: 15 } },
  { id: "talk_local", pool: "Explore", title: "Talk with a local", event: "npc_chat", target: 1, reward: { pence: 300, rep: 15 } },
  { id: "buy_furniture", pool: "Enterprise", title: "Buy a piece of furniture", event: "furniture_bought", target: 1, reward: { pence: 1000, rep: 50 } },
  { id: "paid_task", pool: "Enterprise", title: "Complete a paid task", event: "side_task_paid", target: 1, reward: { pence: 500, rep: 25 } },
  { id: "practise", pool: "Enterprise", title: "Practise a skill", event: "practised", target: 1, reward: { pence: 400, rep: 20 } },
  { id: "work_shift", pool: "Enterprise", title: "Complete a work shift", event: "shift_completed", target: 1, reward: { pence: 800, rep: 40 } },
];

export const missionDef = (id: string) => MISSIONS.find((m) => m.id === id);
