import type { CareerDef, WorkTaskDef } from "./types";

/**
 * LONDON CONTENT DEFAULTS (spec ch. 10.3, 31). Fictional roles and pay.
 * Pay per full shift = rank base × career multiplier × grade uplift.
 */
export const RANK_BASE_PENCE = [12000, 18000, 28000, 45000, 70000];
export const GRADE_UPLIFT = [1, 1.05, 1.1];
export const GRADE_NAMES = ["I", "II", "III"];

export const SHIFT = {
  minutes: 60,
  /** Leaving before this pays nothing (source-observed six minutes). */
  minPaidMinutes: 6,
  startPerformance: 50,
  promotionPerformance: 100,
  shiftsPerGrade: 2,
  performanceAfterPromotion: 60,
  minEnergy: 15,
  minHunger: 15,
  /** Primary-skill XP per full shift, prorated. */
  xpPerShift: 30,
  /** Task timings in shift minutes: each task is open until the next one appears. */
  taskMinutes: [8, 22, 36, 50],
  taskWindowMinutes: 8,
  taskPayBonus: 0.04,
  taskPerf: { success: 3, ok: 0, fail: -2 },
};

/** Work styles: per-hour rates integrated over the time spent in each style. */
export const WORK_STYLES = {
  steady: { name: "Steady", blurb: "Reliable progress.", perf: 10, energy: -10, fun: -4, social: 0 },
  hard: { name: "Work hard", blurb: "Faster progress, draining.", perf: 15, energy: -20, fun: -10, social: 0 },
  social: { name: "Chat with colleagues", blurb: "Slower progress, good company.", perf: 5, energy: -6, fun: 2, social: 15 },
  impress: { name: "Impress the manager", blurb: "Strong progress; may backfire.", perf: 12, energy: -14, fun: -6, social: 4 },
  easy: { name: "Take it easy", blurb: "Barely moves, barely tires.", perf: 3, energy: -3, fun: 2, social: 0 },
} as const;
export type WorkStyle = keyof typeof WORK_STYLES;

/** Chance per started impress-hour that the manager is unimpressed (−5 performance), rolled once per shift. */
export const IMPRESS_BACKFIRE = { chance: 0.2, perf: -5 };

/** Fictional weekly tax on wages (DESIGN DEFAULT, not UK tax law). */
export const WAGE_TAX = { allowancePence: 40000, rate: 0.2 };

const OFFICE_DAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

export const CAREERS: CareerDef[] = [
  {
    id: "tech",
    name: "Technology",
    blurb: "Build software for a fintech start-up on the 9th floor.",
    workplace: "city_office",
    skill: "coding",
    multiplier: 1.1,
    ranks: [
      { title: "Intern" },
      { title: "Junior Developer", gate: { skill: "coding", level: 2 } },
      { title: "Developer", gate: { skill: "coding", level: 4 } },
      { title: "Team Lead", gate: { skill: "charisma", level: 3 } },
      { title: "CTO", gate: { skill: "coding", level: 8 } },
    ],
    workdays: OFFICE_DAYS,
    window: [7, 20],
    tasks: "tech",
  },
  {
    id: "banking",
    name: "Banking",
    blurb: "Help customers and grow a branch on the ground floor.",
    workplace: "city_office",
    skill: "charisma",
    multiplier: 1.15,
    ranks: [
      { title: "Customer Adviser" },
      { title: "Banker", gate: { skill: "charisma", level: 2 } },
      { title: "Branch Manager", gate: { skill: "enterprise", level: 3 } },
      { title: "Regional Director", gate: { skill: "charisma", level: 6 } },
      { title: "Managing Director", gate: { skill: "enterprise", level: 8 } },
    ],
    workdays: OFFICE_DAYS,
    window: [7, 20],
    tasks: "banking",
  },
  {
    id: "product",
    name: "Product Management",
    blurb: "Decide what the start-up builds next.",
    workplace: "city_office",
    skill: "enterprise",
    entry: [{ skill: "coding", level: 3 }],
    multiplier: 1.35,
    ranks: [
      { title: "Associate PM" },
      { title: "Product Manager", gate: { skill: "charisma", level: 3 } },
      { title: "Senior PM", gate: { skill: "enterprise", level: 4 } },
      { title: "Head of Product", gate: { skill: "charisma", level: 6 } },
      { title: "Chief Product Officer", gate: { skill: "enterprise", level: 8 } },
    ],
    workdays: OFFICE_DAYS,
    window: [8, 20],
    tasks: "product",
  },
  {
    id: "kitchen",
    name: "Hospitality",
    blurb: "Work the open kitchen at Common Table.",
    workplace: "food_hall",
    skill: "cooking",
    multiplier: 1,
    ranks: [
      { title: "Kitchen Porter" },
      { title: "Commis Chef", gate: { skill: "cooking", level: 2 } },
      { title: "Chef de Partie", gate: { skill: "cooking", level: 4 } },
      { title: "Head Chef", gate: { skill: "cooking", level: 6 } },
      { title: "Restaurateur", gate: { skill: "enterprise", level: 6 } },
    ],
    workdays: EVERY_DAY,
    window: [8, 23],
    tasks: "kitchen",
  },
  {
    id: "community",
    name: "Community Work",
    blurb: "Run programmes at The Common Room for people who need them.",
    workplace: "common_room",
    skill: "charisma",
    multiplier: 0.95,
    ranks: [
      { title: "Support Worker" },
      { title: "Community Officer", gate: { skill: "charisma", level: 2 } },
      { title: "Project Lead", gate: { skill: "enterprise", level: 3 } },
      { title: "Centre Manager", gate: { skill: "charisma", level: 5 } },
      { title: "Director of Services", gate: { skill: "enterprise", level: 7 } },
    ],
    workdays: EVERY_DAY,
    window: [7, 22],
    tasks: "community",
  },
];

export const careerDef = (id: string) => CAREERS.find((c) => c.id === id);

export function salaryPence(career: CareerDef, rank: number, grade: number) {
  return Math.round((RANK_BASE_PENCE[rank - 1] * career.multiplier * GRADE_UPLIFT[grade - 1]) / 10) * 10;
}

export function roleTitle(career: CareerDef, rank: number, grade: number) {
  return `${career.ranks[rank - 1].title} ${GRADE_NAMES[grade - 1]}`;
}

const t = (id: string, prompt: string, best: string, ok: string, bad: string): WorkTaskDef => ({
  id,
  prompt,
  options: [
    { text: best, outcome: "success" },
    { text: ok, outcome: "ok" },
    { text: bad, outcome: "fail" },
  ],
});

/** Job-specific decisions. Option order is shuffled per shift on the server. */
export const WORK_TASKS: Record<string, WorkTaskDef[]> = {
  tech: [
    t("tech-1", "A test fails only on Fridays. What do you check first?", "Code that depends on the date", "Re-run it and hope", "Delete the test"),
    t("tech-2", "Your pull request has 40 files. Reviewers are slow.", "Split it into smaller PRs", "Ping reviewers again", "Merge it without review"),
    t("tech-3", "Production is slow after your deploy.", "Roll back, then investigate", "Add more servers", "Wait to see if it settles"),
    t("tech-4", "A user reports their password reset email never arrives.", "Check the email provider's logs", "Ask them to check spam", "Reset it manually in the database"),
    t("tech-5", "You're asked to estimate a feature you don't understand.", "Ask questions, then give a range", "Guess two weeks", "Promise it by Friday"),
    t("tech-6", "A teammate's code has a security hole.", "Flag it privately with a fix", "Mention it in stand-up", "Ignore it, not your code"),
    t("tech-7", "The build takes 25 minutes.", "Cache dependencies between runs", "Run it less often", "Skip the tests"),
    t("tech-8", "You find an API key committed to the repo.", "Revoke it and rotate the key", "Delete the file", "Leave it, the repo is private"),
  ],
  banking: [
    t("bank-1", "A customer wants a loan they clearly can't afford.", "Explain why and suggest a budget plan", "Offer a smaller loan", "Approve it to hit target"),
    t("bank-2", "An elderly customer is withdrawing their savings for a 'courier'.", "Gently check for a scam and pause it", "Process it quickly", "Tell them it's none of your business"),
    t("bank-3", "The queue is out the door.", "Open a second desk and triage", "Work faster", "Close for lunch on time"),
    t("bank-4", "A small business asks why their card payments are delayed.", "Check the settlement schedule with them", "Promise it'll clear tomorrow", "Blame the card network"),
    t("bank-5", "Your manager asks you to push a high-fee account.", "Recommend what suits each customer", "Mention it to everyone", "Sign customers up without asking"),
    t("bank-6", "Two deposits don't match the paperwork.", "Reconcile before closing", "Note it for tomorrow", "Adjust the figures to match"),
    t("bank-7", "A student asks how to build credit.", "Explain on-time payments and limits", "Give them a leaflet", "Sell them a credit card"),
    t("bank-8", "A customer is upset about a fee.", "Listen, explain, refund if it's wrong", "Read the policy aloud", "Tell them to complain online"),
  ],
  product: [
    t("pm-1", "Sales wants a feature for one big client.", "Check whether other users need it too", "Add it to the backlog", "Promise it this week"),
    t("pm-2", "Sign-ups are down 20% since Tuesday.", "Look at what changed on Tuesday", "Run a promotion", "Wait for next month's report"),
    t("pm-3", "Design and engineering disagree on scope.", "Agree the smallest version that tests the idea", "Let them argue it out", "Pick the bigger version"),
    t("pm-4", "A user interview contradicts your plan.", "Talk to more users before deciding", "Note it and carry on", "Discard it as an outlier"),
    t("pm-5", "You have three urgent requests and one team.", "Rank by impact and effort", "Do them in order received", "Say yes to all three"),
    t("pm-6", "The launch date is at risk.", "Cut scope and tell stakeholders early", "Ask for overtime", "Keep quiet and hope"),
    t("pm-7", "A competitor launches your idea first.", "Find what users still lack", "Copy their design", "Cancel your project"),
    t("pm-8", "A metric looks great but support tickets are up.", "Investigate the tickets before celebrating", "Share the metric", "Hide the tickets"),
  ],
  kitchen: [
    t("kit-1", "The fridge reads 9°C.", "Move stock to the cold room and report it", "Turn the dial down", "Keep using it"),
    t("kit-2", "A customer says they have a nut allergy.", "Check every ingredient and use clean kit", "Pick a dish without nuts", "Scrape the nuts off"),
    t("kit-3", "Twelve orders land at once.", "Call them in order and batch the sides", "Cook whatever's easiest first", "Panic quietly"),
    t("kit-4", "You've run out of rice mid-service.", "86 the dish and tell the floor", "Send someone to the shop", "Serve it with bread instead"),
    t("kit-5", "Raw chicken is on the shelf above salad.", "Move it below and wipe the shelf", "Move the salad", "Leave it, it's wrapped"),
    t("kit-6", "A colleague burns their hand.", "Cool it under running water for 20 minutes", "Put butter on it", "Tell them to carry on"),
    t("kit-7", "The sauce is too salty.", "Add more base, not sugar", "Add sugar", "Serve it anyway"),
    t("kit-8", "End of shift: half a tray of cooked rice left.", "Cool quickly, label and refrigerate", "Leave it out for tomorrow", "Bin it all"),
  ],
  community: [
    t("com-1", "A visitor arrives upset and won't give their name.", "Offer tea and a quiet space first", "Ask them to fill in a form", "Ask them to come back later"),
    t("com-2", "Two volunteers both want to run the Saturday session.", "Split it and plan together", "Pick the one who asked first", "Cancel the session"),
    t("com-3", "The food bank shelf is nearly empty.", "Post a specific list of what's needed", "Ask for 'anything'", "Turn people away"),
    t("com-4", "Someone needs help with a benefits form.", "Sit with them and go line by line", "Give them the website", "Fill it in for them without asking"),
    t("com-5", "A funder wants numbers by Friday.", "Pull attendance records and add stories", "Estimate", "Copy last year's report"),
    t("com-6", "A regular hasn't been seen for two weeks.", "Ask friends if they're OK and check in", "Note it", "Assume they moved"),
    t("com-7", "Teenagers are hanging around outside.", "Invite them to the games corner", "Ask them to move on", "Call the police"),
    t("com-8", "The heating breaks on a cold day.", "Report it and open the warmer back room", "Hand out blankets", "Close early"),
  ],
};
