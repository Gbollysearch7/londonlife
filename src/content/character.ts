import type { AmbitionDef, HomeTierDef, OriginDef, TraitDef } from "./types";

export const TRAITS: TraitDef[] = [
  { id: "ambitious", name: "Ambitious", blurb: "Learns business fast, gets restless.", xp: { enterprise: 1.2 }, decay: { fun: 1.1 } },
  { id: "sociable", name: "Sociable", blurb: "Charming, but craves company.", xp: { charisma: 1.25 }, decay: { social: 1.2 }, conflicts: ["homebody"] },
  { id: "homebody", name: "Homebody", blurb: "Happy alone, slower to charm.", decay: { social: 0.75 }, xp: { charisma: 0.9 }, conflicts: ["sociable"] },
  { id: "active", name: "Active", blurb: "Fitter, with energy to spare.", xp: { fitness: 1.25 }, decay: { energy: 0.9 } },
  { id: "creative", name: "Creative", blurb: "Music and photos come naturally; bores easily.", xp: { music: 1.2, photography: 1.2 }, decay: { fun: 1.1 } },
  { id: "techie", name: "Tech-minded", blurb: "Picks up code quickly; forgets to see people.", xp: { coding: 1.25 }, decay: { social: 1.1 } },
  { id: "foodie", name: "Foodie", blurb: "A natural cook with a big appetite.", xp: { cooking: 1.25 }, decay: { hunger: 1.1 } },
  { id: "tidy", name: "Tidy", blurb: "Stays fresh for longer; finds downtime harder.", decay: { hygiene: 0.75, fun: 1.1 } },
  { id: "easygoing", name: "Easygoing", blurb: "Rarely bored, slower to hustle.", decay: { fun: 0.8 }, xp: { enterprise: 0.9 } },
  { id: "night_owl", name: "Night Owl", blurb: "Runs on less sleep, eats at odd hours.", decay: { energy: 0.85, hunger: 1.1 } },
];

export const AMBITIONS: AmbitionDef[] = [
  { id: "career_top", name: "Top of the Ladder", blurb: "Reach the highest rank in a career." },
  { id: "home_owner", name: "Keys of My Own", blurb: "Own the home you live in." },
  { id: "music_master", name: "Music Mastery", blurb: "Reach Music level 10." },
  { id: "four_friends", name: "My People", blurb: "Have four best friends." },
  { id: "founder", name: "Founder", blurb: "Build a successful company." },
];

/** Ambitions may be changed once every 7 days (source-faithful cooldown). */
export const AMBITION_COOLDOWN_DAYS = 7;

export const HOME_TIERS: HomeTierDef[] = [
  { id: "student_hall", name: "Student hall room", gridW: 6, gridD: 6, district: "Camden" },
  { id: "shared_room", name: "Room in a shared flat", gridW: 6, gridD: 6, district: "Camden" },
  { id: "outer_studio", name: "Studio flat", gridW: 7, gridD: 7, district: "Camden" },
  { id: "one_bed", name: "One-bedroom flat", gridW: 8, gridD: 8, district: "Camden" },
];

const STARTER = ["single_bed", "toilet", "shower", "camp_hob", "fridge", "storage_chest"];
const BASIC_GROCERIES = { bread: 2, beans: 1, pasta: 1, tomato: 1, tea: 3 };

export const ORIGINS: OriginDef[] = [
  {
    id: "new_student",
    name: "Newly arrived student",
    story: "You landed at King's Cross with two suitcases and a place on a course. Your hall room is small but it's yours.",
    weight: 20,
    cashPence: 10000,
    homeTier: "student_hall",
    furniture: [...STARTER, "desk"],
    groceries: BASIC_GROCERIES,
    skills: { coding: 1 },
    perks: ["A desk for studying at home"],
  },
  {
    id: "graduate_room",
    name: "Graduate renting a room",
    story: "Degree done, job not yet. A room in a Camden flatshare and a lot of ambition.",
    weight: 25,
    cashPence: 15000,
    homeTier: "shared_room",
    furniture: STARTER,
    groceries: BASIC_GROCERIES,
    skills: { charisma: 1 },
    perks: ["Charisma head start"],
  },
  {
    id: "working_londoner",
    name: "Working Londoner",
    story: "Born and raised here. You know every bus route and every shortcut, and you've always had a side hustle.",
    weight: 25,
    cashPence: 22000,
    homeTier: "shared_room",
    furniture: STARTER,
    groceries: { ...BASIC_GROCERIES, rice: 1, plantain: 1 },
    skills: { enterprise: 1 },
    perks: ["Enterprise head start"],
  },
  {
    id: "creative_start",
    name: "Creative starting out",
    story: "You moved for the music scene. Rent is tight, but the guitar came with you.",
    weight: 15,
    cashPence: 12000,
    homeTier: "shared_room",
    furniture: [...STARTER, "guitar"],
    groceries: BASIC_GROCERIES,
    skills: { music: 1 },
    perks: ["Owns an acoustic guitar", "Music head start"],
  },
  {
    id: "family_supported",
    name: "Family-supported professional",
    story: "Your family helped with the deposit on a studio. Now it's on you to make something of it.",
    weight: 10,
    cashPence: 60000,
    homeTier: "outer_studio",
    furniture: [...STARTER, "sofa", "tv", "bookshelf"],
    groceries: { ...BASIC_GROCERIES, eggs: 2, rice: 1 },
    skills: { cooking: 1 },
    perks: ["Studio flat", "Furnished living area"],
  },
  {
    id: "inherited_wealth",
    name: "Inherited wealth",
    story: "A relative left you money and a flat. Wealth opens doors, but skills and friends still have to be earned.",
    weight: 5,
    cashPence: 250000,
    homeTier: "one_bed",
    furniture: [...STARTER.filter((f) => f !== "single_bed" && f !== "camp_hob"), "double_bed", "cooker", "sofa", "tv", "rug", "lamp"],
    groceries: { ...BASIC_GROCERIES, eggs: 2, rice: 2, plantain: 2 },
    skills: {},
    perks: ["One-bedroom flat", "Well furnished"],
  },
];

export const APPEARANCE_OPTIONS = {
  body: ["Presentation A", "Presentation B"],
  skin: ["#F3D7C2", "#E3B58F", "#C68B5E", "#A86B45", "#7A4A2E", "#4E2F1E"],
  hairStyle: ["Short crop", "Curls", "Locs", "Braids", "Bob", "Shaved"],
  hairColour: ["#1B1512", "#4A2E1C", "#8C5A2B", "#C9A15A", "#B04A2F", "#D9D4CC"],
  top: ["#234C42", "#BC3D3B", "#2F4A6B", "#C69C58", "#E9E2D3", "#3A3A3A"],
  bottom: ["#2B2F36", "#46505B", "#5B4632", "#1E3247", "#7A7266"],
  shoes: ["#F4EEE4", "#1A1A1A", "#7A4A2E", "#BC3D3B"],
} as const;

export interface Appearance {
  body: number;
  skin: number;
  hairStyle: number;
  hairColour: number;
  top: number;
  bottom: number;
  shoes: number;
}
