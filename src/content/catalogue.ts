import type { FurnitureDef, ItemDef, RecipeDef } from "./types";
import { CHEF_MEALS } from "./household";
import { PET_FOOD, PRESTIGE_FURNITURE } from "./lateGame";

const WOODS = ["#B98B5E", "#7A5134", "#D9C3A0"];
const FABRICS = ["#234C42", "#BC3D3B", "#2F4A6B", "#C69C58", "#8C8C84"];
const WHITES = ["#F2F0EA", "#D8DCDF"];

export const FURNITURE: FurnitureDef[] = [
  { id: "single_bed", name: "Single Bed", category: "Sleep", pricePence: 6000, w: 1, d: 2, surface: "floor", quality: 1, colours: FABRICS, enables: ["bed", "nap"], blurb: "Sleep and nap. Small but restful." },
  { id: "double_bed", name: "Double Bed", category: "Sleep", pricePence: 18000, w: 2, d: 2, surface: "floor", quality: 2, colours: FABRICS, enables: ["bed", "nap"], blurb: "Sleep recovers 10% more energy." },
  { id: "toilet", name: "Toilet", category: "Bath", pricePence: 4500, w: 1, d: 1, surface: "floor", quality: 1, colours: WHITES, enables: ["toilet"], blurb: "Restores Bladder." },
  { id: "shower", name: "Shower", category: "Bath", pricePence: 9000, w: 1, d: 1, surface: "floor", quality: 1, colours: WHITES, enables: ["shower"], blurb: "Restores Hygiene." },
  { id: "camp_hob", name: "Two-ring Hob", category: "Kitchen", pricePence: 2500, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#3A3A3A", "#F2F0EA"], enables: ["hob"], blurb: "Cook simple recipes." },
  { id: "cooker", name: "Gas Cooker", category: "Kitchen", pricePence: 14000, w: 1, d: 1, surface: "floor", quality: 2, colours: ["#F2F0EA", "#3A3A3A", "#234C42"], enables: ["hob"], blurb: "Cooks 30% faster than a hob." },
  { id: "fridge", name: "Fridge", category: "Kitchen", pricePence: 12000, w: 1, d: 1, surface: "floor", quality: 1, colours: WHITES, enables: ["fridge"], blurb: "Grab a quick snack from your groceries." },
  { id: "armchair", name: "Armchair", category: "Comfort", pricePence: 4000, w: 1, d: 1, surface: "floor", quality: 1, colours: FABRICS, enables: ["seat"], blurb: "Put your feet up: Fun and a little Energy." },
  { id: "sofa", name: "Two-seat Sofa", category: "Comfort", pricePence: 8500, w: 2, d: 1, surface: "floor", quality: 2, colours: FABRICS, enables: ["seat", "nap"], blurb: "Relax, or nap without a bed." },
  { id: "tv", name: "Flat TV", category: "Fun", pricePence: 7000, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#1A1A1A"], enables: ["tv"], blurb: "Watch TV for Fun." },
  { id: "bookshelf", name: "Bookshelf", category: "Skills", pricePence: 3500, w: 1, d: 1, surface: "floor", quality: 1, colours: WOODS, enables: ["books"], blurb: "Read cookbooks and coding books." },
  { id: "desk", name: "Laptop Desk", category: "Skills", pricePence: 7500, w: 2, d: 1, surface: "floor", quality: 1, colours: WOODS, enables: ["desk"], blurb: "Practise Coding at home for free." },
  { id: "guitar", name: "Acoustic Guitar", category: "Skills", pricePence: 5000, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#B98B5E", "#1A1A1A"], enables: ["guitar"], blurb: "Practise Music." },
  { id: "dumbbells", name: "Dumbbell Rack", category: "Skills", pricePence: 3000, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#3A3A3A"], enables: ["weights"], blurb: "Home workouts train Fitness." },
  { id: "storage_chest", name: "Storage Chest", category: "Decor", pricePence: 3500, w: 1, d: 1, surface: "floor", quality: 1, colours: WOODS, enables: [], decor: 1, blurb: "Somewhere to keep your things." },
  { id: "plant", name: "Potted Plant", category: "Decor", pricePence: 1200, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#3E7A4F"], enables: [], decor: 2, blurb: "A bit of green. Lifts mood." },
  { id: "lamp", name: "Floor Lamp", category: "Light", pricePence: 2500, w: 1, d: 1, surface: "floor", quality: 1, colours: ["#C69C58", "#1A1A1A"], enables: [], decor: 1, blurb: "Warm evening light." },
  { id: "rug", name: "Woven Rug", category: "Decor", pricePence: 3000, w: 2, d: 2, surface: "overlay", quality: 2, colours: ["#A45A45", "#234C42", "#C69C58"], enables: [], decor: 2, blurb: "Lies under furniture." },
  { id: "poster", name: "Gig Poster", category: "Decor", pricePence: 800, w: 1, d: 1, surface: "wall", quality: 1, colours: ["#BC3D3B", "#2F4A6B", "#C69C58"], enables: [], decor: 1, blurb: "Hangs on a wall." },
  { id: "party_speakers", name: "Party Speakers", category: "Fun", pricePence: 7200, w: 1, d: 1, surface: "floor", quality: 2, colours: ["#1A1A1A", "#F2F0EA", "#BC3D3B"], enables: ["speakers"], blurb: "Turn it up: throw a house party at home (one a night)." },
  { id: "wall_clock", name: "Wall Clock", category: "Decor", pricePence: 1500, w: 1, d: 1, surface: "wall", quality: 1, colours: ["#17232B", "#F2F0EA"], enables: [], decor: 1, blurb: "Hangs on a wall." },
  ...PRESTIGE_FURNITURE,
  // Original art sold only at the Riverside Arts House gallery (one of each per character). Fictional artists.
  { id: "art_river_dusk", name: "River at Dusk", category: "Decor", pricePence: 6000, w: 1, d: 1, surface: "wall", quality: 2, colours: ["#B98B5E", "#17232B", "#C69C58"], enables: [], decor: 3, soldAt: "riverside_arts", artist: "Mara Ellison", blurb: "Original oil painting of the Thames going violet. Hangs on a wall." },
  { id: "art_market_morning", name: "Market Morning", category: "Decor", pricePence: 4500, w: 1, d: 1, surface: "wall", quality: 2, colours: ["#F2F0EA", "#17232B"], enables: [], decor: 2, soldAt: "riverside_arts", artist: "Kofi Danquah", blurb: "Original gouache of crates, awnings and early light. Hangs on a wall." },
  { id: "art_estate_bloom", name: "Estate in Bloom", category: "Decor", pricePence: 3500, w: 1, d: 1, surface: "wall", quality: 1, colours: ["#17232B", "#7A5134"], enables: [], decor: 2, soldAt: "riverside_arts", artist: "Priti Chauhan", blurb: "Hand-pulled linocut of tower blocks and window boxes. Hangs on a wall." },
  { id: "art_clay_heron", name: "Clay Heron", category: "Decor", pricePence: 8500, w: 1, d: 1, surface: "floor", quality: 2, colours: ["#8C8C84", "#C06A4A", "#E9E2D3"], enables: [], decor: 3, soldAt: "riverside_arts", artist: "Agnes Mbeki", blurb: "Original glazed sculpture on a plinth. Stands on the floor." },
];

export const ITEMS: ItemDef[] = [
  { id: "bread", name: "Bread", kind: "grocery", pricePence: 110, unit: "slices" },
  { id: "beans", name: "Tin of beans", kind: "grocery", pricePence: 80, unit: "tin" },
  { id: "pasta", name: "Pasta", kind: "grocery", pricePence: 120, unit: "portion" },
  { id: "tomato", name: "Tomatoes", kind: "grocery", pricePence: 60, unit: "portion" },
  { id: "tea", name: "Tea bags", kind: "grocery", pricePence: 30, unit: "bag" },
  { id: "eggs", name: "Eggs", kind: "grocery", pricePence: 50, unit: "pair" },
  { id: "rice", name: "Rice", kind: "grocery", pricePence: 100, unit: "portion" },
  { id: "plantain", name: "Plantain", kind: "grocery", pricePence: 90, unit: "each" },
  { id: "snack_bar", name: "Snack bar", kind: "grocery", pricePence: 100, unit: "each" },
  { id: "potato", name: "Baking potato", kind: "grocery", pricePence: 70, unit: "each" },
  { id: "cheese", name: "Cheddar", kind: "grocery", pricePence: 150, unit: "portion" },
  { id: "chickpeas", name: "Chickpeas", kind: "grocery", pricePence: 90, unit: "tin" },
  { id: "peppers", name: "Peppers", kind: "grocery", pricePence: 80, unit: "portion" },
  PET_FOOD,
  { id: "tea_and_toast", name: "Tea and toast", kind: "meal", eat: { hunger: 20, energy: 6, fun: 3 } },
  { id: "beans_on_toast", name: "Beans on toast", kind: "meal", eat: { hunger: 35, fun: 2 } },
  { id: "egg_on_toast", name: "Egg on toast", kind: "meal", eat: { hunger: 30, energy: 4 } },
  { id: "pasta_bowl", name: "Pasta bowl", kind: "meal", eat: { hunger: 40, fun: 4 } },
  { id: "jollof_rice", name: "Jollof rice with plantain", kind: "meal", eat: { hunger: 50, fun: 8 } },
  { id: "jacket_potato", name: "Jacket potato with cheese", kind: "meal", eat: { hunger: 42, fun: 4, energy: 3 } },
  { id: "chickpea_curry", name: "Chickpea curry with rice", kind: "meal", eat: { hunger: 52, fun: 8 } },
  { id: "stuffed_peppers", name: "Stuffed peppers", kind: "meal", eat: { hunger: 46, fun: 10, energy: 4 } },
  { id: "takeaway_curry", name: "Takeaway curry", kind: "meal", eat: { hunger: 45, fun: 8 } },
  { id: "takeaway_noodles", name: "Takeaway noodles", kind: "meal", eat: { hunger: 40, fun: 6 } },
  { id: "takeaway_pizza", name: "Takeaway pizza", kind: "meal", eat: { hunger: 50, fun: 10 } },
  ...CHEF_MEALS,
];

export const RECIPES: RecipeDef[] = [
  { id: "tea_and_toast", name: "Tea and toast", ingredients: { bread: 1, tea: 1 }, makes: "tea_and_toast", minutes: 2, xp: 6, cookingLevel: 0 },
  { id: "beans_on_toast", name: "Beans on toast", ingredients: { bread: 1, beans: 1 }, makes: "beans_on_toast", minutes: 3, xp: 8, cookingLevel: 0 },
  { id: "egg_on_toast", name: "Egg on toast", ingredients: { bread: 1, eggs: 1 }, makes: "egg_on_toast", minutes: 3, xp: 8, cookingLevel: 0 },
  { id: "pasta_bowl", name: "Pasta bowl", ingredients: { pasta: 1, tomato: 1 }, makes: "pasta_bowl", minutes: 4, xp: 10, cookingLevel: 0 },
  { id: "jollof_rice", name: "Jollof rice with plantain", ingredients: { rice: 1, tomato: 1, plantain: 1 }, makes: "jollof_rice", minutes: 6, xp: 16, cookingLevel: 2 },
  { id: "jacket_potato", name: "Jacket potato", ingredients: { potato: 1, cheese: 1 }, makes: "jacket_potato", minutes: 5, xp: 10, cookingLevel: 0 },
  { id: "chickpea_curry", name: "Chickpea curry", ingredients: { chickpeas: 1, tomato: 1, rice: 1 }, makes: "chickpea_curry", minutes: 7, xp: 18, cookingLevel: 3 },
  { id: "stuffed_peppers", name: "Stuffed peppers", ingredients: { peppers: 1, rice: 1, cheese: 1 }, makes: "stuffed_peppers", minutes: 7, xp: 20, cookingLevel: 4 },
];

export const furnitureDef = (id: string) => FURNITURE.find((f) => f.id === id);
export const itemDef = (id: string) => ITEMS.find((i) => i.id === id);
