/**
 * Minigames (spec ch. 10 "timed dexterity challenge", ch. 30 quiz and open mic).
 * Pure content and scoring; the server picks questions/beat maps, checks answers and pays bounded rewards.
 * Rhythm inputs are submitted by the client, so rewards are capped and daily-limited rather than open-ended.
 */
import { seededRandom } from "@/sim/shift";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  /** Index of the correct option. */
  answer: number;
}

/** Original London general-knowledge questions. */
export const QUIZ: QuizQuestion[] = [
  { id: "q_thames", prompt: "Which river flows through central London?", options: ["The Severn", "The Thames", "The Mersey", "The Avon"], answer: 1 },
  { id: "q_tube", prompt: "What do Londoners call the Underground?", options: ["The Pipe", "The Metro", "The Tube", "The Line"], answer: 2 },
  { id: "q_bus", prompt: "What colour are London's double-decker buses traditionally?", options: ["Red", "Green", "Blue", "Yellow"], answer: 0 },
  { id: "q_bigben", prompt: "'Big Ben' is the nickname of what?", options: ["A clock hand", "The great bell in the Elizabeth Tower", "A Thames ferry", "A royal guard"], answer: 1 },
  { id: "q_towerbridge", prompt: "Which bridge has two towers and lifts its road for tall ships?", options: ["London Bridge", "Millennium Bridge", "Tower Bridge", "Westminster Bridge"], answer: 2 },
  { id: "q_borough", prompt: "Which food market sits near London Bridge station?", options: ["Borough Market", "Smithfield", "Billingsgate", "Leadenhall"], answer: 0 },
  { id: "q_canal", prompt: "Which canal runs through Camden?", options: ["Grand Union Canal", "Regent's Canal", "Bridgewater Canal", "Kennet and Avon Canal"], answer: 1 },
  { id: "q_eye", prompt: "What is the big observation wheel on the South Bank called?", options: ["The Thames Wheel", "The London Eye", "The Ferris Royal", "The Millennium Wheel of Light"], answer: 1 },
  { id: "q_shard", prompt: "The Shard stands next to which station?", options: ["Victoria", "Paddington", "London Bridge", "Euston"], answer: 2 },
  { id: "q_central", prompt: "On the Tube map, what colour is the Central line?", options: ["Red", "Green", "Purple", "Brown"], answer: 0 },
  { id: "q_circle", prompt: "Which Tube line is shown in yellow?", options: ["Jubilee", "Circle", "District", "Bakerloo"], answer: 1 },
  { id: "q_northern", prompt: "Which Tube line is shown in black?", options: ["Northern", "Piccadilly", "Victoria", "Metropolitan"], answer: 0 },
  { id: "q_victoria", prompt: "Which Tube line is shown in light blue?", options: ["Piccadilly", "Waterloo & City", "Victoria", "Hammersmith & City"], answer: 2 },
  { id: "q_wren", prompt: "Who designed St Paul's Cathedral?", options: ["Christopher Wren", "Isambard Kingdom Brunel", "Inigo Jones", "John Nash"], answer: 0 },
  { id: "q_nelson", prompt: "The tall column in Trafalgar Square honours whom?", options: ["Wellington", "Admiral Nelson", "Churchill", "King Alfred"], answer: 1 },
  { id: "q_guard", prompt: "Where does the famous Changing of the Guard take place?", options: ["The Tower of London", "Kensington Palace", "Buckingham Palace", "Hampton Court"], answer: 2 },
  { id: "q_rosetta", prompt: "Which museum holds the Rosetta Stone?", options: ["The British Museum", "The Science Museum", "The V&A", "The Natural History Museum"], answer: 0 },
  { id: "q_gallery", prompt: "Which gallery overlooks Trafalgar Square?", options: ["Tate Britain", "The National Gallery", "The Saatchi Gallery", "The Courtauld"], answer: 1 },
  { id: "q_tate", prompt: "Tate Modern is housed in a former what?", options: ["Railway station", "Brewery", "Power station", "Department store"], answer: 2 },
  { id: "q_knowledge", prompt: "The famous test black-cab drivers must pass is called…", options: ["The Knowledge", "The Map", "The Route", "The Circuit"], answer: 0 },
  { id: "q_westend", prompt: "London's main theatre district is known as…", options: ["The East End", "The West End", "The Square Mile", "The South Bank Strip"], answer: 1 },
  { id: "q_carnival", prompt: "Notting Hill Carnival happens in which month?", options: ["May", "June", "August", "October"], answer: 2 },
  { id: "q_oxford", prompt: "Which street is home to Selfridges' flagship store?", options: ["Oxford Street", "Bond Street", "Regent Street", "Carnaby Street"], answer: 0 },
  { id: "q_wimbledon", prompt: "Which sport is played at Wimbledon's famous championships?", options: ["Cricket", "Tennis", "Rugby", "Golf"], answer: 1 },
  { id: "q_lords", prompt: "Lord's, the home of cricket, is in which area?", options: ["Hampstead", "Clapham", "St John's Wood", "Chiswick"], answer: 2 },
  { id: "q_serpentine", prompt: "What is the lake in Hyde Park called?", options: ["The Serpentine", "The Long Water Lily", "The Round Pond", "The Thames Basin"], answer: 0 },
  { id: "q_meridian", prompt: "Greenwich is famous for which line?", options: ["The Equator", "The Prime Meridian", "The Tropic of Cancer", "The Date Line"], answer: 1 },
  { id: "q_westminster", prompt: "The Houses of Parliament are also called the Palace of…", options: ["Whitehall", "St James's", "Westminster", "Kensington"], answer: 2 },
  { id: "q_metropolitan", prompt: "Which line includes the world's first underground railway, opened in 1863?", options: ["Metropolitan", "Central", "Jubilee", "Elizabeth"], answer: 0 },
  { id: "q_mindgap", prompt: "'Mind the gap' warns about the gap between the train and…", options: ["The tunnel", "The platform", "The next carriage", "The escalator"], answer: 1 },
  { id: "q_gherkin", prompt: "The Gherkin's official address is…", options: ["1 Canada Square", "20 Fenchurch Street", "30 St Mary Axe", "110 Bishopsgate"], answer: 2 },
  { id: "q_oyster", prompt: "In London, an Oyster is a kind of…", options: ["Travel card", "Black cab", "Pub snack", "Market stall"], answer: 0 },
  { id: "q_columbia", prompt: "Which East London market is famous for Sunday flowers?", options: ["Brick Lane", "Columbia Road", "Spitalfields", "Roman Road"], answer: 1 },
  { id: "q_liquor", prompt: "Traditional pie and mash comes with a green parsley sauce called…", options: ["Gravy verde", "Mushy", "Liquor", "Jellied jus"], answer: 2 },
  { id: "q_harrods", prompt: "Which famous department store is in Knightsbridge?", options: ["Harrods", "Liberty", "Fortnum & Mason", "John Lewis"], answer: 0 },
  { id: "q_kew", prompt: "Kew Gardens is best known as…", options: ["A football ground", "Botanic gardens", "A royal palace", "A street market"], answer: 1 },
  { id: "q_brixton", prompt: "Brixton is part of which London borough?", options: ["Southwark", "Lewisham", "Lambeth", "Wandsworth"], answer: 2 },
  { id: "q_square_mile", prompt: "'The Square Mile' is a nickname for…", options: ["The City of London", "Hyde Park", "Soho", "Canary Wharf"], answer: 0 },
];

export const QUIZ_LENGTH = 5;
export const QUIZ_SECONDS_PER_QUESTION = 15;

/** Five distinct questions for a run, chosen from its seed. */
export function pickQuestions(seed: string, n = QUIZ_LENGTH): QuizQuestion[] {
  const rand = seededRandom(`quiz:${seed}`);
  const pool = [...QUIZ];
  const out: QuizQuestion[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

export function quizScore(questions: QuizQuestion[], answers: unknown[]): number {
  return questions.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
}

/** Prize by correct answers (fictional pounds in pence, reputation, stars). */
export function quizPrize(correct: number): { pence: number; rep: number; stars: number; label: string } {
  if (correct >= 5) return { pence: 2500, rep: 20, stars: 1, label: "Perfect round! The whole pub cheers." };
  if (correct === 4) return { pence: 1200, rep: 12, stars: 0, label: "So close. Runner-up prize." };
  if (correct === 3) return { pence: 500, rep: 6, stars: 0, label: "A respectable middle of the table." };
  return { pence: 0, rep: 0, stars: 0, label: "Not your night — but a fun one." };
}

// ───────────────────────────── rhythm ─────────────────────────────

export interface Note {
  /** Milliseconds after the song starts. */
  t: number;
  lane: 0 | 1 | 2;
}

export interface RhythmSpec {
  bpm: number;
  notes: number;
  /** Tips (or prize) at a perfect performance, in pence. */
  maxPayPence: number;
  /** Pays only at or above this performance score (dance battle prize). */
  threshold?: number;
  skill: "music" | "dance";
  title: string;
}

export const RHYTHM: Record<string, RhythmSpec> = {
  open_mic: { bpm: 96, notes: 28, maxPayPence: 2000, skill: "music", title: "Open mic" },
  busk: { bpm: 104, notes: 30, maxPayPence: 2500, skill: "music", title: "Busking" },
  dance_battle: { bpm: 120, notes: 36, maxPayPence: 4000, threshold: 0.7, skill: "dance", title: "Dance battle" },
};

export const RHYTHM_LEAD_MS = 2000;
export const HIT_WINDOW_MS = 150;

/** A deterministic beat map: notes on the beat or half-beat, avoiding impossible same-lane bursts. */
export function beatMap(seed: string, spec: RhythmSpec): Note[] {
  const rand = seededRandom(`beats:${seed}`);
  const beat = 60000 / spec.bpm;
  const notes: Note[] = [];
  let t = RHYTHM_LEAD_MS;
  let lastLane = -1;
  while (notes.length < spec.notes) {
    let lane = Math.floor(rand() * 3) as 0 | 1 | 2;
    if (lane === lastLane && rand() < 0.6) lane = ((lane + 1 + Math.floor(rand() * 2)) % 3) as 0 | 1 | 2;
    notes.push({ t: Math.round(t), lane });
    lastLane = lane;
    t += rand() < 0.25 && notes.length > 6 ? beat / 2 : beat;
  }
  return notes;
}

export const songLengthMs = (notes: Note[]) => (notes.length ? notes[notes.length - 1].t + 1200 : 0);

/**
 * Matches taps to notes (same lane, within the window, each note at most once) and returns accuracy 0–1.
 * Spamming is penalised: extra taps beyond the note count reduce the result.
 */
export function rhythmAccuracy(notes: Note[], taps: unknown): { hits: number; accuracy: number } {
  if (!Array.isArray(taps) || !notes.length) return { hits: 0, accuracy: 0 };
  const clean = taps
    .filter((x): x is { t: number; lane: number } => !!x && typeof x === "object" && Number.isFinite((x as { t: number }).t) && [0, 1, 2].includes((x as { lane: number }).lane))
    .slice(0, notes.length * 3)
    .sort((a, b) => a.t - b.t);
  const used = new Uint8Array(notes.length);
  let hits = 0;
  for (const tap of clean) {
    let best = -1;
    let bestD = HIT_WINDOW_MS + 1;
    for (let i = 0; i < notes.length; i++) {
      if (used[i] || notes[i].lane !== tap.lane) continue;
      const d = Math.abs(notes[i].t - tap.t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      used[best] = 1;
      hits++;
    }
  }
  const extra = Math.max(0, clean.length - hits - Math.ceil(notes.length * 0.25));
  const accuracy = Math.max(0, Math.min(1, (hits - extra * 0.5) / notes.length));
  return { hits, accuracy };
}

/** Performance blends timing accuracy (75%) with real skill level (25%), so practice matters too. */
export function performanceScore(accuracy: number, skillLevel: number) {
  return Math.max(0, Math.min(1, accuracy * 0.75 + Math.min(1, skillLevel / 6) * 0.25));
}

export function rhythmReward(spec: RhythmSpec, score: number): { pence: number; xpMult: number; label: string } {
  const xpMult = 0.5 + score;
  if (spec.threshold !== undefined) {
    if (score >= 0.85) return { pence: spec.maxPayPence, xpMult, label: "You won the battle! The floor goes wild." };
    if (score >= spec.threshold) return { pence: Math.round(spec.maxPayPence * 0.4), xpMult, label: "Runner-up. A crowd favourite." };
    return { pence: 0, xpMult, label: "Knocked out in round one — the crowd still clapped." };
  }
  const pence = Math.round((spec.maxPayPence * Math.max(0, score - 0.2)) / 0.8 / 10) * 10;
  const label = score >= 0.85 ? "Standing ovation!" : score >= 0.6 ? "The crowd loved it." : score >= 0.35 ? "A warm reception." : "A tough crowd tonight.";
  return { pence, xpMult, label };
}
