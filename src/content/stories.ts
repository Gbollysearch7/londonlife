import type { LocationId, Needs, SkillId } from "./types";

/**
 * Branching stories as authored graphs (spec ch. 21). Original London stories.
 * A node may require arrival at a venue; choices can be gated by skill or money, cost money,
 * train a skill, change needs or roll a server-side chance that uses a skill. Endings pay once per story.
 */
export interface StoryChoice {
  id: string;
  label: string;
  /** Hard gate: the choice is locked until the skill reaches this level. */
  requires?: { skill: SkillId; level: number };
  costPence?: number;
  needs?: Partial<Needs>;
  xp?: { skill: SkillId; amount: number };
  /** Success chance = base + perLevel × skill level, clamped to 5–95%. */
  chance?: { base: number; skill?: SkillId; perLevel?: number };
  next: string;
  /** Where a failed chance leads. */
  failNext?: string;
}

export interface StoryNode {
  id: string;
  location?: LocationId;
  text: string;
  choices: StoryChoice[];
  ending?: { title: string; rep: number; stars: number; pence: number; text: string };
}

export interface StoryDef {
  id: string;
  title: string;
  blurb: string;
  start: string;
  nodes: StoryNode[];
}

const end = (id: string, title: string, text: string, rep: number, stars: number, pence = 0): StoryNode => ({ id, text, choices: [], ending: { title, rep, stars, pence, text } });

export const STORIES: StoryDef[] = [
  {
    id: "open_mic_camden",
    title: "Open Mic in Camden",
    blurb: "Jules has a spare slot at the Backroom tonight. Are you brave enough?",
    start: "invite",
    nodes: [
      {
        id: "invite",
        location: "home",
        text: "A message from Jules: “Slot at the Backroom tonight — want it?” Your stomach flips. There's just enough time to run through something first.",
        choices: [
          { id: "rehearse", label: "Rehearse a set at home", xp: { skill: "music", amount: 15 }, needs: { energy: -5, fun: 4 }, next: "ready" },
          { id: "wing", label: "No time — head straight there", next: "cold" },
        ],
      },
      {
        id: "ready",
        location: "camden_backroom",
        text: "You walk in warmed up and humming. Jules waves you over: “Music, comedy or poetry? Your call.”",
        choices: [
          { id: "music", label: "Play a song", chance: { base: 0.55, skill: "music", perLevel: 0.07 }, next: "buzz", failNext: "heckle" },
          { id: "comedy", label: "Try five minutes of stand-up", chance: { base: 0.45, skill: "comedy", perLevel: 0.08 }, next: "buzz", failNext: "heckle" },
          { id: "poetry", label: "Read a poem about the 24 bus", chance: { base: 0.7, skill: "charisma", perLevel: 0.04 }, next: "buzz", failNext: "heckle" },
        ],
      },
      {
        id: "cold",
        location: "camden_backroom",
        text: "Your hands are shaking as Jules hands you the mic. “Music, comedy or poetry?”",
        choices: [
          { id: "music", label: "Play a song", chance: { base: 0.35, skill: "music", perLevel: 0.07 }, next: "buzz", failNext: "heckle" },
          { id: "comedy", label: "Try five minutes of stand-up", chance: { base: 0.3, skill: "comedy", perLevel: 0.08 }, next: "buzz", failNext: "heckle" },
          { id: "poetry", label: "Read a poem about the 24 bus", chance: { base: 0.5, skill: "charisma", perLevel: 0.04 }, next: "buzz", failNext: "heckle" },
        ],
      },
      {
        id: "heckle",
        location: "camden_backroom",
        text: "Halfway through, someone at the bar shouts, “Get on with it!” A few people laugh. The room is waiting to see what you do.",
        choices: [
          { id: "laugh", label: "Laugh it off with a quick comeback", requires: { skill: "charisma", level: 2 }, next: "saved" },
          { id: "song", label: "Turn the heckle into a song", requires: { skill: "music", level: 3 }, next: "saved" },
          { id: "push", label: "Push through to the end", next: "end_ok" },
        ],
      },
      {
        id: "buzz",
        location: "camden_backroom",
        text: "The room is with you. People are clapping along. Jules grins and mouths: “Encore?”",
        choices: [
          { id: "encore", label: "Play the encore", needs: { energy: -6, fun: 10 }, next: "end_star" },
          { id: "bow", label: "Bow out while they want more", next: "end_good" },
        ],
      },
      {
        id: "saved",
        location: "camden_backroom",
        text: "The heckler raises his glass to you. The room's laughter is on your side now, and you finish to a proper cheer.",
        choices: [{ id: "finish", label: "Take your bow", next: "end_good" }],
      },
      end("end_star", "Camden's new favourite", "Jules books you a regular slot. Strangers stop you on the high street.", 90, 2, 3000),
      end("end_good", "A night to remember", "Not a disaster, not a legend — but you did it, and the regulars know your name.", 60, 1, 1500),
      end("end_ok", "You survived", "It wasn't pretty, but you finished. Next time will be easier.", 25, 0),
    ],
  },
  {
    id: "night_bus",
    title: "Lost on the Night Bus",
    blurb: "A bag left on the back seat. Whose is it, and what will you do?",
    start: "bus",
    nodes: [
      {
        id: "bus",
        location: "home",
        text: "On the last bus home you spot a bag on the back seat. Inside: a phone with a cracked screen, a library card and a recipe book full of handwritten notes.",
        choices: [
          { id: "keep", label: "Take it, and find the owner yourself", next: "library" },
          { id: "driver", label: "Hand it to the driver", next: "end_driver" },
          { id: "leave", label: "Leave it — not your problem", next: "end_ignore" },
        ],
      },
      {
        id: "library",
        location: "reading_library",
        text: "Hal squints at the card. “That's Mo. In here every Tuesday reading about spices.” He won't give out addresses, but he might give you a hint.",
        choices: [
          { id: "charm", label: "Ask Hal nicely where Mo spends his days", requires: { skill: "charisma", level: 1 }, next: "market" },
          { id: "clues", label: "Look through the recipe book for clues", next: "receipt" },
        ],
      },
      {
        id: "market",
        location: "borough_market",
        text: "Dele laughs. “Mo? He sells spice mixes here on Saturdays. Today he went down to the river to busk — he does that when he's stressed.”",
        choices: [{ id: "river", label: "Head for the river", next: "found" }],
      },
      {
        id: "receipt",
        location: "food_hall",
        text: "Tucked in the book is a Common Table receipt. Nia nods: “Mo! Every lunchtime. He rushed off towards the South Bank looking upset.”",
        choices: [{ id: "river", label: "Head for the river", next: "found" }],
      },
      {
        id: "found",
        location: "south_bank",
        text: "By the railings, a man is searching his pockets for the tenth time. He sees the bag in your hand and his whole face changes.",
        choices: [
          { id: "return", label: "Hand everything back", next: "end_hero" },
          { id: "reward", label: "Hint that a reward would be nice", chance: { base: 0.5, skill: "charisma", perLevel: 0.05 }, next: "end_reward", failNext: "end_awkward" },
        ],
      },
      end("end_hero", "A friend for life", "Mo insists you come to his supper club. Word gets around that you're someone to trust.", 80, 1),
      end("end_reward", "Paid in thanks", "Mo presses some notes into your hand. Fair enough — you crossed half of London.", 30, 0, 2500),
      end("end_awkward", "Awkward", "Mo thanks you stiffly and walks off. Maybe don't ask next time.", 10, 0),
      end("end_driver", "Doing the right thing", "The driver logs it with lost property. The owner gets it back eventually.", 20, 0),
      end("end_ignore", "Someone else's problem", "You get off at your stop. You'll never know whose it was.", 0, 0),
    ],
  },
  {
    id: "guest_list",
    title: "The Guest List",
    blurb: "A rooftop launch, a spare invite and a dress code. Get in, then make it count.",
    start: "salon",
    nodes: [
      {
        id: "salon",
        location: "crown_and_curl",
        text: "Precious waves an invite: “Rooftop launch at East Yard tonight. My friend dropped out — but you can't go looking like that.”",
        choices: [
          { id: "buy", label: "Buy a sharp vintage jacket at the market (£25)", costPence: 2500, next: "market" },
          { id: "borrow", label: "Borrow something loud from the salon rail", next: "borrowed" },
        ],
      },
      {
        id: "market",
        location: "borough_market",
        text: "The vintage stall has a green jacket that fits like it was made for you. Dele whistles as you walk past.",
        choices: [{ id: "go", label: "Head to the launch", needs: { fun: 6 }, next: "door" }],
      },
      {
        id: "borrowed",
        location: "crown_and_curl",
        text: "It's very orange. Precious says it's “a statement”. It will have to do.",
        choices: [{ id: "go", label: "Head to the launch", next: "door" }],
      },
      {
        id: "door",
        location: "east_yard",
        text: "The doorman runs a finger down his clipboard. “Not on the list.” Behind him you can hear music and laughter on the roof.",
        choices: [
          { id: "honest", label: "Explain Precious sent you", chance: { base: 0.6, skill: "charisma", perLevel: 0.05 }, next: "roof", failNext: "side" },
          { id: "bluff", label: "Bluff: “I'm with the DJ”", chance: { base: 0.35 }, next: "roof", failNext: "end_bounced" },
          { id: "zara", label: "Message Zara to vouch for you", requires: { skill: "enterprise", level: 2 }, next: "roof" },
        ],
      },
      {
        id: "side",
        location: "east_yard",
        text: "No luck at the front. Round the side, the caterers are short-handed and someone hands you a tray.",
        choices: [{ id: "trays", label: "Carry trays up to the roof", needs: { energy: -10 }, xp: { skill: "enterprise", amount: 10 }, next: "roof" }],
      },
      {
        id: "roof",
        location: "east_yard",
        text: "The roof glows with festoon lights and the whole skyline is out. Who do you spend the evening with?",
        choices: [
          { id: "pitch", label: "Pitch yourself to a founder", chance: { base: 0.4, skill: "enterprise", perLevel: 0.08 }, next: "end_contact", failNext: "end_fun" },
          { id: "dance", label: "Own the dance floor", xp: { skill: "dance", amount: 20 }, needs: { fun: 15, energy: -8 }, next: "end_fun" },
          { id: "chat", label: "Chat with everyone", xp: { skill: "charisma", amount: 15 }, needs: { social: 20 }, next: "end_fun" },
        ],
      },
      end("end_contact", "A new contact", "The founder takes your number: “Come and see us next week.” Doors are opening.", 120, 2),
      end("end_fun", "Best night in ages", "No life-changing deals, just a brilliant evening above the city.", 60, 1),
      end("end_bounced", "Bounced", "The doorman doesn't buy it. You get chips on the way home — what a story, though.", 10, 0),
    ],
  },
  {
    id: "five_minute_pitch",
    title: "The Five-Minute Pitch",
    blurb: "Zara's pitch night: three investors, five minutes, one shot.",
    start: "idea",
    nodes: [
      {
        id: "idea",
        location: "east_yard",
        text: "Zara pins up a poster: Pitch Night, Thursday. “Five minutes, three investors. Got an idea?” You do — an app to share spare allotment veg.",
        choices: [
          { id: "proto", label: "Build a rough prototype first", xp: { skill: "coding", amount: 20 }, needs: { energy: -8 }, next: "prototype" },
          { id: "slides", label: "Just make some slides", next: "stage" },
        ],
      },
      {
        id: "prototype",
        location: "east_yard",
        text: "It works — mostly. The map loads, the photos upload, the login button does something mysterious. Do you dig for evidence or go for it?",
        choices: [
          { id: "research", label: "Research the market at the library", next: "library" },
          { id: "straight", label: "Go straight to the stage", next: "stage" },
        ],
      },
      {
        id: "library",
        location: "reading_library",
        text: "Hal finds you a council report on allotment waiting lists. Real numbers. You copy the best chart onto your last slide.",
        choices: [{ id: "back", label: "Back to East Yard", xp: { skill: "enterprise", amount: 15 }, next: "stage_evidence" }],
      },
      {
        id: "stage",
        location: "east_yard",
        text: "Lights up. The first investor folds her arms: “Why would anyone pay for this?”",
        choices: [
          { id: "hype", label: "Hype it: “It's the future of food!”", chance: { base: 0.3, skill: "charisma", perLevel: 0.05 }, next: "end_interest", failNext: "end_learn" },
          { id: "honest", label: "Be honest about what's unproven", xp: { skill: "enterprise", amount: 10 }, next: "end_learn" },
        ],
      },
      {
        id: "stage_evidence",
        location: "east_yard",
        text: "Lights up. “Why would anyone pay for this?” You click to your chart. The room goes quiet in the good way.",
        choices: [
          { id: "numbers", label: "Walk them through the numbers", chance: { base: 0.7, skill: "enterprise", perLevel: 0.04 }, next: "end_interest", failNext: "end_learn" },
          { id: "story", label: "Tell the story of your gran's allotment", chance: { base: 0.55, skill: "charisma", perLevel: 0.05 }, next: "end_interest", failNext: "end_learn" },
        ],
      },
      end("end_interest", "They want a second meeting", "Zara offers you a permanent desk and an intro to an angel investor. It's a start, not a fortune.", 100, 2),
      end("end_learn", "Valuable lessons", "No deal tonight, but the feedback is gold. You'll pitch again.", 50, 1),
    ],
  },
  {
    id: "derby_day",
    title: "Derby Day",
    blurb: "The Last Stop is rammed for the big match. Find a seat — and maybe glory.",
    start: "packed",
    nodes: [
      {
        id: "packed",
        location: "last_stop_pub",
        text: "Derby day. The Last Stop is shoulder to shoulder and Sam looks frazzled. “No seats, love. Unless…”",
        choices: [
          { id: "help", label: "Offer to help behind the bar", needs: { energy: -10 }, xp: { skill: "enterprise", amount: 12 }, next: "barside" },
          { id: "away", label: "Squeeze in with the away fans", next: "away" },
        ],
      },
      {
        id: "barside",
        location: "last_stop_pub",
        text: "An hour of pouring ginger beer later, Sam saves you the best stool in the house. The second half kicks off.",
        choices: [{ id: "watch", label: "Settle in to watch", needs: { fun: 10 }, next: "halftime" }],
      },
      {
        id: "away",
        location: "last_stop_pub",
        text: "The away fans are friendly enough — until the home end starts a chant aimed squarely at them. All eyes turn to you.",
        choices: [
          { id: "song", label: "Start a better song that everyone can sing", requires: { skill: "music", level: 2 }, needs: { social: 15 }, next: "halftime" },
          { id: "quiet", label: "Keep your head down", next: "halftime" },
        ],
      },
      {
        id: "halftime",
        location: "last_stop_pub",
        text: "Half-time quiz! Sam needs a captain for the mixed-fans team. A ripple goes round: someone has to do it.",
        choices: [
          { id: "captain", label: "Captain the team", chance: { base: 0.5, skill: "charisma", perLevel: 0.06 }, next: "end_legend", failNext: "end_good" },
          { id: "cheer", label: "Cheer from the back", next: "end_good" },
        ],
      },
      end("end_legend", "Pub legend", "Your team wins by a point. Sam puts your name on the chalkboard: Captain of the Day.", 90, 2, 1000),
      end("end_good", "A proper day out", "Great match, good company. You're one of the regulars now.", 45, 1),
    ],
  },
];

export const storyDef = (id: string) => STORIES.find((s) => s.id === id);
export const storyNode = (story: StoryDef, id: string) => story.nodes.find((n) => n.id === id);

/** Chance clamped to 5–95% so nothing is certain and nothing is hopeless. */
export function choiceChance(c: StoryChoice, levels: Partial<Record<SkillId, number>>, charismaBonus = 0): number | null {
  if (!c.chance) return null;
  const lvl = c.chance.skill ? levels[c.chance.skill] ?? 0 : 0;
  const bonus = c.chance.skill === "charisma" ? charismaBonus : 0;
  return Math.max(0.05, Math.min(0.95, c.chance.base + (c.chance.perLevel ?? 0) * lvl + bonus));
}

/** Graph layout for the phone view: depth by breadth-first search from the start node. */
export function storyLayout(story: StoryDef) {
  const depth = new Map<string, number>([[story.start, 0]]);
  const queue = [story.start];
  const edges: [string, string][] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = storyNode(story, id)!;
    for (const c of node.choices) {
      for (const to of [c.next, c.failNext].filter(Boolean) as string[]) {
        if (!edges.some(([a, b]) => a === id && b === to)) edges.push([id, to]);
        if (!depth.has(to)) {
          depth.set(to, depth.get(id)! + 1);
          queue.push(to);
        }
      }
    }
  }
  const rows = new Map<number, string[]>();
  for (const [id, d] of depth) rows.set(d, [...(rows.get(d) ?? []), id]);
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [d, ids] of rows) ids.forEach((id, i) => (pos[id] = { x: d, y: i - (ids.length - 1) / 2 }));
  return { pos, edges, columns: rows.size };
}

// ───────────────────────────── daily treasure ─────────────────────────────

export interface TreasureSpot {
  id: string;
  venue: LocationId;
  /** Anchor in the venue layout where the gem sparkles. */
  anchor: string;
  clue: string;
}

export const TREASURE_SPOTS: TreasureSpot[] = [
  { id: "t_pond", venue: "regents_green", anchor: "pond", clue: "Where herons fish and ducks hold court, a glint waits by the water." },
  { id: "t_stage", venue: "camden_backroom", anchor: "stage", clue: "Under the lights where nervous hands hold the mic, something shines." },
  { id: "t_shelves", venue: "reading_library", anchor: "desk", clue: "Between the pages where it's quiet, a gem is studying too." },
  { id: "t_railing", venue: "south_bank", anchor: "railing", clue: "Lean on the iron and watch the water: the river keeps a secret." },
  { id: "t_stall", venue: "borough_market", anchor: "vintage", clue: "Among the odd teapots and old records, one treasure isn't for sale." },
  { id: "t_court", venue: "learning_campus", anchor: "court", clue: "Five-a-side, two goals, one sparkle on the halfway line." },
  { id: "t_darts", venue: "last_stop_pub", anchor: "darts", clue: "Bullseye! Look near where the arrows fly." },
  { id: "t_bench", venue: "east_yard", anchor: "bench", clue: "Where broken gadgets come back to life, something precious is waiting." },
  { id: "t_tables", venue: "food_hall", anchor: "table", clue: "Shared tables, shared plates — and one shared secret." },
  { id: "t_board", venue: "common_room", anchor: "board", clue: "Pinned among the notices, a little light is waiting for a neighbour." },
  { id: "t_studio", venue: "borough_athletics", anchor: "studio", clue: "Breathe in, stretch out, and look down at the mats." },
  { id: "t_sofa", venue: "crown_and_curl", anchor: "sofa", clue: "Where clients wait and gossip flows, something sparkles in the cushions." },
  { id: "t_pocket", venue: "chalk_cushion", anchor: "pool", clue: "Chalk on your fingers, green baize below: one pocket holds more than a ball." },
  { id: "t_garden", venue: "riverside_arts", anchor: "garden", clue: "Behind the theatre, beside the ivy, a fountain hides a glint." },
  { id: "t_departures", venue: "kings_cross_gateway", anchor: "board", clue: "Read where the trains are going, then look down: a treasure missed its train." },
];

/** Reward by claim order (fictional): the first finder earns most. */
export function treasureReward(rank: number) {
  if (rank === 1) return 5000;
  if (rank <= 3) return 2500;
  if (rank <= 10) return 1000;
  return 300;
}
