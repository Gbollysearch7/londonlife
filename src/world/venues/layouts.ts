import type { Appearance } from "@/content/character";
import type { Scene } from "@/client/sound";
import type { Outfit } from "../Avatar";
import type { Pose, Prop } from "../poses";
import type { PropSpec, Shell } from "./props";
import { LAYOUTS_A } from "./layouts_a";

/** Where the avatar stands (or sits) to do something. Angles in degrees; 0 faces +Z. */
export interface AnchorSpec {
  pos: [number, number];
  rotY: number;
  /** Walk to here first, then glide onto `pos` (seats, beds and stages sit inside a blocked footprint). */
  approach?: [number, number];
  /** Height of the surface the avatar stands or lies on. */
  y?: number;
  /** True when the anchor is a seat, so seated poses are used. */
  seat?: boolean;
  /** Shown as a clickable hotspot with this label. */
  label?: string;
  icon?: string;
}

export interface NpcSpec {
  id: string;
  appearance: Appearance;
  outfit?: Outfit;
  pos: [number, number];
  rotY: number;
  pose: Pose;
  prop?: Prop;
}

/** A non-interactive background Londoner (never presented as a player). */
export interface ExtraSpec {
  seed: number;
  pos: [number, number];
  rotY: number;
  pose: Pose;
  prop?: Prop;
  y?: number;
}

export interface VenueLayout {
  shell: Shell;
  props: PropSpec[];
  anchors: Record<string, AnchorSpec>;
  npcs: NpcSpec[];
  extras?: ExtraSpec[];
  /** Number of background walkers wandering the walkable floor. */
  walkers?: number;
  spawn: [number, number];
  camera: { pos: [number, number, number]; target: [number, number, number] };
  sound: Scene;
  /** Anchor used while working a shift here. */
  workAnchor?: string;
}

const NIA: Appearance = { body: 1, skin: 4, hairStyle: 3, hairColour: 0, top: 4, bottom: 0, shoes: 1 };
const BEV: Appearance = { body: 1, skin: 1, hairStyle: 4, hairColour: 5, top: 1, bottom: 3, shoes: 2 };
const PRIYA: Appearance = { body: 1, skin: 3, hairStyle: 4, hairColour: 0, top: 2, bottom: 0, shoes: 1 };

const calm = (layers: Scene["layers"]): Scene => ({ layers, music: "calm" });

export const LAYOUTS: Record<string, VenueLayout> = {
  food_hall: {
    shell: { size: [12, 9], floor: { kind: "checker", c1: "#d8cfc1", c2: "#bfb3a3" }, back: { kind: "brick", c: "#8e4e3e" }, left: { kind: "brick", c: "#86493b" } },
    props: [
      { t: "kitchen_back", p: [0, -4.2], w: 6 },
      { t: "counter", p: [0, -3.0], w: 6, c: "#234C42" },
      { t: "sign", p: [0, -4.48], text: "Common Table", y: 2.75, w: 3.4, h: 0.85, c: "#17232b" },
      { t: "sign", p: [0, -4.47], text: "Plate of the day £5 · Curry bowl £7", y: 2.18, w: 3.6, h: 0.3, c: "#234C42" },
      { t: "long_table", p: [-2.5, 1] },
      { t: "long_table", p: [0.5, 1] },
      { t: "long_table", p: [3.5, 1] },
      { t: "shelf", p: [5.45, -1.5], r: -90, w: 2.6 },
      { t: "pendant", p: [-3, 1] },
      { t: "pendant", p: [0, 1] },
      { t: "pendant", p: [3, 1] },
      { t: "plant", p: [5.3, 3.8] },
      { t: "plant", p: [-5.3, -3.9] },
      { t: "wc_door", p: [-5.96, -1.5], r: 90 },
      { t: "door", p: [-5.96, 2.9], r: 90 },
    ],
    anchors: {
      counter: { pos: [0.8, -2.1], rotY: 180, label: "Counter", icon: "◉" },
      table: { pos: [-3.35, 0.4], rotY: 90, approach: [-3.95, 0.4], seat: true, label: "Tables", icon: "◐" },
      groceries: { pos: [4.6, -1.5], rotY: 90, label: "Grocery shelves", icon: "▤" },
      wc: { pos: [-5.4, -1.5], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.3, 2.9], rotY: -90, label: "Leave", icon: "⌖" },
      work: { pos: [-0.8, -3.55], rotY: 0 },
    },
    npcs: [{ id: "nia", appearance: NIA, pos: [0.8, -3.55], rotY: 0, pose: "cook", prop: "pan" }],
    extras: [
      { seed: 11, pos: [1.35, 1.5], rotY: -90, pose: "eat" },
      { seed: 12, pos: [-0.35, 0.2], rotY: 90, pose: "eat" },
      { seed: 13, pos: [2.65, 1.9], rotY: 90, pose: "talk" },
      { seed: 14, pos: [4.35, 0.6], rotY: -90, pose: "eat" },
    ],
    walkers: 2,
    spawn: [-4.9, 2.9],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ murmur: 0.8, room: 0.3 }),
    workAnchor: "work",
  },

  common_room: {
    shell: { size: [11, 9], floor: { kind: "wood", c1: "#c9b79a", c2: "#bca98b" }, back: { kind: "plaster", c: "#e8dcc6", c2: "#c8b39b" }, left: { kind: "plaster", c: "#dccdb3", c2: "#c2ad92" } },
    props: [
      { t: "bunting", p: [0, -4.4], w: 9.6, y: 3.0 },
      { t: "noticeboard", p: [-1.5, -4.45], w: 2.4, y: 1.6 },
      { t: "hatch", p: [3.2, -3.9], w: 3 },
      { t: "old_sofa", p: [-4.6, 0.5], r: 90, w: 2.2 },
      { t: "computer_desk", p: [2.6, 1.2], w: 2.6 },
      { t: "round_table", p: [-1.2, 1.6] },
      { t: "pendant", p: [0, 0], y: 2.8 },
      { t: "pendant", p: [3, 0], y: 2.8 },
      { t: "plant", p: [4.9, -4.0] },
      { t: "door", p: [-4.0, -4.44], text: "Showers", c: "#4d8fa8" },
      { t: "wc_door", p: [-5.46, -2.4], r: 90 },
      { t: "door", p: [-5.46, 3.1], r: 90 },
    ],
    anchors: {
      kitchen: { pos: [3.2, -3.05], rotY: 180, label: "Kitchen hatch", icon: "◐" },
      board: { pos: [-1.3, -3.4], rotY: 180, label: "Noticeboard", icon: "▤" },
      computers: { pos: [1.95, 1.82], rotY: 180, approach: [1.95, 2.5], seat: true, label: "Computers", icon: "⌨" },
      games: { pos: [-1.2, 2.5], rotY: 180, seat: true, label: "Shared table", icon: "◎" },
      sofa: { pos: [-4.55, 1.45], rotY: 0, approach: [-3.7, 0.9], y: 0.0, seat: true, label: "Old sofa", icon: "☾" },
      shower: { pos: [-4.0, -3.9], rotY: 180, label: "Showers", icon: "◇" },
      wc: { pos: [-4.9, -2.4], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-4.8, 3.1], rotY: -90, label: "Leave", icon: "⌖" },
      work: { pos: [3.2, -3.05], rotY: 180 },
    },
    npcs: [{ id: "bev", appearance: BEV, pos: [-0.2, -3.6], rotY: 23, pose: "idle" }],
    extras: [
      { seed: 21, pos: [-2.0, 1.1], rotY: 60, pose: "talk" },
      { seed: 22, pos: [3.25, 1.82], rotY: 180, pose: "type" },
    ],
    walkers: 1,
    spawn: [-4.4, 3.1],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ murmur: 0.45, room: 0.4 }),
    workAnchor: "work",
  },

  city_office: {
    shell: { size: [12, 9], floor: { kind: "carpet", c1: "#c3c8cc", c2: "#b4bac0" }, back: { kind: "window" }, left: { kind: "plaster", c: "#e6e8ea", c2: "#cfd3d6" } },
    props: [
      { t: "skyline", p: [0, -11], w: 26 },
      { t: "reception", p: [-4.2, 2.6] },
      { t: "office_desk", p: [-2, -2.4] },
      { t: "office_desk", p: [0.4, -2.4] },
      { t: "office_desk", p: [2.8, -2.4] },
      { t: "office_desk", p: [-2, 0.2] },
      { t: "office_desk", p: [0.4, 0.2] },
      { t: "office_desk", p: [2.8, 0.2] },
      { t: "glass_pod", p: [4.8, 2.6] },
      { t: "break_kitchen", p: [4.6, -3.5] },
      { t: "water_cooler", p: [3.2, -3.9] },
      { t: "plant", p: [-5.4, -3.9] },
      { t: "plant", p: [-5.4, 0.2] },
      { t: "pendant", p: [-2, -1.1], y: 2.8, c: "#17232b" },
      { t: "pendant", p: [0.4, -1.1], y: 2.8, c: "#17232b" },
      { t: "pendant", p: [2.8, -1.1], y: 2.8, c: "#17232b" },
      { t: "wc_door", p: [-5.96, -2.0], r: 90 },
      { t: "door", p: [-5.96, 3.4], r: 90 },
    ],
    anchors: {
      kitchen: { pos: [4.6, -2.75], rotY: 180, label: "Break kitchen", icon: "◐" },
      reception: { pos: [-4.2, 3.5], rotY: 180, label: "Reception", icon: "◉" },
      wc: { pos: [-5.4, -2.0], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.3, 3.4], rotY: -90, label: "Leave", icon: "⌖" },
      work: { pos: [0.4, 0.82], rotY: 180, approach: [0.4, 1.45], seat: true },
    },
    npcs: [{ id: "priya", appearance: PRIYA, pos: [-4.2, 1.9], rotY: 17, pose: "idle" }],
    extras: [
      { seed: 31, pos: [-2, -1.78], rotY: 180, pose: "type" },
      { seed: 32, pos: [2.8, 0.82], rotY: 180, pose: "type" },
      { seed: 33, pos: [2.8, -1.78], rotY: 180, pose: "type" },
    ],
    walkers: 1,
    spawn: [-4.8, 3.4],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ office: 0.7, room: 0.3 }),
    workAnchor: "work",
  },

  camden_backroom: {
    shell: { size: [12, 9], floor: { kind: "wood", c1: "#5a3f2a", c2: "#4a3322" }, back: { kind: "brick", c: "#5a2e2a" }, left: { kind: "panel", c: "#4a2e22" } },
    props: [
      { t: "stage", p: [-1, -3.3], w: 5, d: 2, h: 0.4 },
      { t: "drum_kit", p: [-2.4, -3.8], lift: 0.4 },
      { t: "speaker", p: [-3.95, -3.6], lift: 0.4 },
      { t: "speaker", p: [1.95, -3.6], lift: 0.4 },
      { t: "mic_stand", p: [-0.6, -2.95], lift: 0.4 },
      { t: "bar", p: [4.75, 0.2], r: -90, w: 5 },
      { t: "neon", p: [3.4, -4.45], text: "Backroom", c: "#ff6fae", y: 2.7, h: 0.55 },
      { t: "cafe_table", p: [-4.1, 2.3] },
      { t: "cafe_table", p: [-1.4, 3.1] },
      { t: "pendant", p: [-3, 2.4], c: "#5a1e24" },
      { t: "pendant", p: [0, 2.6], c: "#5a1e24" },
      { t: "wc_door", p: [-5.96, -1.5], r: 90 },
      { t: "door", p: [-5.96, 0.8], r: 90 },
    ],
    anchors: {
      stage: { pos: [-0.6, -2.55], rotY: 0, y: 0.4, approach: [-0.6, -1.75], label: "Stage", icon: "♪" },
      floor: { pos: [-0.9, -0.8], rotY: 180, label: "Dance floor", icon: "★" },
      bar: { pos: [3.85, 0.9], rotY: 90, approach: [3.2, 0.9], seat: true, label: "Bar", icon: "◐" },
      wc: { pos: [-5.4, -1.5], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.3, 0.8], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "jules", appearance: { body: 0, skin: 5, hairStyle: 2, hairColour: 0, top: 5, bottom: 3, shoes: 1 }, outfit: { top: 3, hat: 3 }, pos: [3.0, -1.6], rotY: -50, pose: "strum" }],
    extras: [
      { seed: 41, pos: [-2.3, -0.5], rotY: 180, pose: "dance" },
      { seed: 42, pos: [0.6, -0.2], rotY: 200, pose: "dance" },
      { seed: 43, pos: [-4.1, 2.85], rotY: 180, pose: "sit" },
      { seed: 44, pos: [3.85, -0.5], rotY: 90, pose: "sit" },
    ],
    walkers: 1,
    spawn: [-4.9, 0.8],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.6] },
    sound: calm({ murmur: 0.6, room: 0.2 }),
  },

  regents_green: {
    shell: { size: [16, 12], floor: { kind: "grass", c1: "#6f9a52", c2: "#5f8a48" }, outdoor: true },
    props: [
      { t: "paving", p: [0, 4.6], w: 16, d: 1.4 },
      { t: "hedge", p: [0, -5.7], w: 16 },
      { t: "skyline", p: [0, -34], w: 70 },
      { t: "pond", p: [3.6, -2.6], w: 5, d: 3.2 },
      { t: "pavilion", p: [-4, -2.8], w: 3.4, d: 3 },
      { t: "tree", p: [-6.6, -4.4], h: 1.2 },
      { t: "tree", p: [-2.6, -4.9], v: 1 },
      { t: "tree", p: [7, -4.6], h: 1.1, v: 2 },
      { t: "tree", p: [7.1, 2.2], v: 3 },
      { t: "tree", p: [-7.1, 2.6], h: 0.9, v: 1 },
      { t: "tree", p: [0.6, -4.6], h: 0.8, v: 2 },
      { t: "bench", p: [1.2, 3.55] },
      { t: "bench", p: [-3.6, 3.55] },
      { t: "picnic_blanket", p: [-2.2, 1.0] },
      { t: "lamp_post", p: [4.8, 3.6] },
      { t: "lamp_post", p: [-5.6, 3.6] },
      { t: "kiosk", p: [6.4, -0.8], r: 180 },
    ],
    anchors: {
      path: { pos: [0, 4.6], rotY: 90, label: "Running loop", icon: "➜" },
      lawn: { pos: [-0.6, 0.6], rotY: 160, label: "The lawn", icon: "✿" },
      pond: { pos: [3.6, -0.55], rotY: 180, label: "Duck pond", icon: "◎" },
      bench: { pos: [1.2, 3.5], rotY: 0, approach: [1.2, 4.3], seat: true, label: "Bench", icon: "☾" },
      wc: { pos: [6.4, -1.75], rotY: 0, label: "Toilets", icon: "▽" },
      exit: { pos: [-7.3, 4.6], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "kemi", appearance: { body: 1, skin: 4, hairStyle: 3, hairColour: 0, top: 1, bottom: 3, shoes: 3 }, outfit: { top: 0, bottom: 3, hat: 2 }, pos: [0.4, -0.6], rotY: 20, pose: "talk" }],
    extras: [
      { seed: 51, pos: [2.6, 1.2], rotY: 60, pose: "phone" },
      { seed: 52, pos: [-4.6, -2.6], rotY: 30, pose: "idle" },
    ],
    walkers: 3,
    spawn: [-6.6, 4.6],
    camera: { pos: [6, 8, 12], target: [0, 0.6, 0] },
    sound: calm({ birds: 0.8, wind: 0.3, city: 0.12 }),
  },

  reading_library: {
    shell: { size: [12, 9], floor: { kind: "herringbone", c1: "#a07850", c2: "#8c6644" }, back: { kind: "panel", c: "#6b4a32" }, left: { kind: "plaster", c: "#e9e0cf", c2: "#c9b79a" } },
    props: [
      { t: "bookcase", p: [-3.8, -4.2], w: 3 },
      { t: "bookcase", p: [0.2, -4.2], w: 3 },
      { t: "bookcase", p: [5.75, 0.6], r: -90, w: 3 },
      { t: "reception", p: [3.8, -2.0], c: "#5a3f2a" },
      { t: "reading_table", p: [-1.8, -0.4], w: 2.4 },
      { t: "reading_table", p: [1.6, -0.4], w: 2.4 },
      { t: "computer_desk", p: [3.0, 2.8], w: 2.6 },
      { t: "armchair", p: [-3.9, 2.6], r: 40, c: "#234C42" },
      { t: "armchair", p: [-2.2, 3.4], r: 180, c: "#BC3D3B" },
      { t: "plant", p: [-5.4, 0.2] },
      { t: "pendant", p: [-1.8, -0.4], c: "#234C42" },
      { t: "pendant", p: [1.6, -0.4], c: "#234C42" },
      { t: "wc_door", p: [-5.96, -3.0], r: 90 },
      { t: "door", p: [-5.96, 3.3], r: 90 },
    ],
    anchors: {
      desk: { pos: [-2.4, 0.22], rotY: 180, approach: [-2.4, 0.95], seat: true, label: "Reading tables", icon: "▤" },
      computers: { pos: [2.35, 3.42], rotY: 180, approach: [2.35, 4.0], seat: true, label: "Public computers", icon: "⌨" },
      group: { pos: [-3.86, 2.65], rotY: 40, approach: [-3.1, 3.35], seat: true, label: "Reading group", icon: "☺" },
      wc: { pos: [-5.4, -3.0], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.3, 3.3], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "hal", appearance: { body: 0, skin: 0, hairStyle: 5, hairColour: 5, top: 2, bottom: 2, shoes: 2 }, outfit: { top: 4, glasses: true }, pos: [3.8, -2.7], rotY: 0, pose: "read" }],
    extras: [
      { seed: 61, pos: [1.0, 0.22], rotY: 180, pose: "read" },
      { seed: 62, pos: [2.2, 0.22], rotY: 180, pose: "read" },
      { seed: 63, pos: [3.65, 3.42], rotY: 180, pose: "type" },
    ],
    spawn: [-4.9, 3.3],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ room: 0.35 }),
  },

  learning_campus: {
    shell: { size: [14, 10], floor: { kind: "concrete", c1: "#c9c4ba", c2: "#bdb7ad" }, back: { kind: "plaster", c: "#e6e2d8", c2: "#2F4A6B" }, left: { kind: "brick", c: "#a45a45" } },
    props: [
      { t: "whiteboard", p: [-3, -4.95], w: 3.6, text: "Week 3: Loops & lists" },
      { t: "lecture_seats", p: [-3, -0.6], r: 180, w: 6, d: 3 },
      { t: "counter", p: [4.2, -4.1], w: 4, c: "#2F4A6B" },
      { t: "sign", p: [4.2, -4.97], text: "Canteen", y: 2.5, w: 2.2, h: 0.55, c: "#2F4A6B" },
      { t: "cafe_table", p: [3.0, -1.8] },
      { t: "cafe_table", p: [5.4, -1.8] },
      { t: "court", p: [3.6, 2.6], w: 5.6, d: 3.4 },
      { t: "plant", p: [-6.4, 4.4] },
      { t: "pendant", p: [4.2, -2.6], c: "#2F4A6B" },
      { t: "wc_door", p: [-6.96, -3.4], r: 90 },
      { t: "door", p: [-6.96, 3.6], r: 90 },
    ],
    anchors: {
      lecture: { pos: [-3.55, -2.6], rotY: 180, label: "Lecture hall", icon: "▤" },
      canteen: { pos: [4.2, -3.2], rotY: 180, label: "Canteen", icon: "◐" },
      court: { pos: [3.6, 2.6], rotY: 90, label: "Five-a-side court", icon: "⚽" },
      wc: { pos: [-6.4, -3.4], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-6.3, 3.6], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "adeyemi", appearance: { body: 0, skin: 4, hairStyle: 0, hairColour: 5, top: 2, bottom: 0, shoes: 1 }, outfit: { top: 3, glasses: true }, pos: [-1.6, -4.3], rotY: 10, pose: "talk" }],
    extras: [
      { seed: 71, pos: [-3.0, -1.9], rotY: 180, pose: "read", y: 0.2 },
      { seed: 72, pos: [-4.4, -0.9], rotY: 180, pose: "read", y: 0.4 },
      { seed: 73, pos: [-1.6, -0.9], rotY: 180, pose: "type", y: 0.4 },
      { seed: 74, pos: [3.0, -1.25], rotY: 180, pose: "eat" },
    ],
    walkers: 2,
    spawn: [-6.0, 3.6],
    camera: { pos: [6, 8, 12], target: [0, 0.8, -0.3] },
    sound: calm({ murmur: 0.45, room: 0.3 }),
  },

  east_yard: {
    shell: { size: [13, 9], floor: { kind: "concrete", c1: "#9a978f", c2: "#8e8b84" }, back: { kind: "brick", c: "#7a4a3a" }, left: { kind: "plaster", c: "#d9d6cf", c2: "#46505b" } },
    props: [
      { t: "computer_desk", p: [-2.4, -2.8], w: 2.6 },
      { t: "computer_desk", p: [1.2, -2.8], w: 2.6 },
      { t: "stage", p: [4.6, -3.4], w: 3, d: 1.8, h: 0.3, c: "#2b2f36" },
      { t: "screen", p: [4.6, -4.45], text: "Demo night · Thu 19:00", w: 2.6, h: 1.3, y: 2.3, c: "#234C42" },
      { t: "counter", p: [-3.4, 1.9], w: 2.4, c: "#46505b" },
      { t: "crate", p: [-4.9, 1.9] },
      { t: "crate", p: [-4.9, 2.6], c: "#7a5134" },
      { t: "break_kitchen", p: [5.4, 1.2], r: -90 },
      { t: "sofa", p: [0.8, 2.8], w: 2.2, c: "#BC3D3B" },
      { t: "plant", p: [3.0, 3.6] },
      { t: "pendant", p: [-2.4, -1.6], c: "#17232b" },
      { t: "pendant", p: [1.2, -1.6], c: "#17232b" },
      { t: "neon", p: [-1.0, -4.45], text: "build things", c: "#ffd27a", y: 2.7, h: 0.5 },
      { t: "wc_door", p: [-6.46, -0.6], r: 90 },
      { t: "door", p: [-6.46, 3.4], r: 90 },
    ],
    anchors: {
      desks: { pos: [-3.05, -2.18], rotY: 180, approach: [-3.05, -1.45], seat: true, label: "Hot desks", icon: "⌨" },
      stage: { pos: [4.6, -3.1], rotY: 0, y: 0.3, approach: [4.6, -2.05], label: "Demo stage", icon: "★" },
      bench: { pos: [-3.4, 2.65], rotY: 180, label: "Prototype bench", icon: "⚙" },
      kitchen: { pos: [4.65, 1.2], rotY: 90, label: "Coffee bar", icon: "◐" },
      wc: { pos: [-5.9, -0.6], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.8, 3.4], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "zara", appearance: { body: 1, skin: 2, hairStyle: 4, hairColour: 4, top: 5, bottom: 1, shoes: 0 }, outfit: { top: 3 }, pos: [2.6, 0.5], rotY: -30, pose: "talk" }],
    extras: [
      { seed: 81, pos: [-1.75, -2.18], rotY: 180, pose: "type" },
      { seed: 82, pos: [0.55, -2.18], rotY: 180, pose: "type" },
      { seed: 83, pos: [1.85, -2.18], rotY: 180, pose: "type" },
    ],
    walkers: 1,
    spawn: [-5.4, 3.4],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ office: 0.5, murmur: 0.3 }),
  },

  last_stop_pub: {
    shell: { size: [13, 9], floor: { kind: "wood", c1: "#6b4a32", c2: "#5a3f2a" }, back: { kind: "panel", c: "#5a3a26" }, left: { kind: "brick", c: "#7c4337" } },
    props: [
      { t: "bar", p: [2.6, -3.2], w: 5 },
      { t: "booth", p: [-4.7, -1.8], w: 2 },
      { t: "booth", p: [-4.7, 1.5], w: 2 },
      { t: "screen", p: [-3.6, -4.45], text: "DERBY DAY · 1–1", w: 2.6, h: 1.5, y: 2.1, c: "#234C42" },
      { t: "dartboard", p: [-0.9, -4.45] },
      { t: "round_table", p: [0.6, 1.4] },
      { t: "cafe_table", p: [3.8, 2.4], c: "#5a3f2a" },
      { t: "sign", p: [2.6, -4.47], text: "The Last Stop", y: 3.0, w: 3.2, h: 0.55, c: "#5a1e24" },
      { t: "pendant", p: [0.6, 1.4], c: "#5a1e24" },
      { t: "pendant", p: [-4.7, -0.2], c: "#5a1e24" },
      { t: "plant", p: [5.9, 3.8] },
      { t: "wc_door", p: [-6.46, -0.15], r: 90 },
      { t: "door", p: [-6.46, 3.7], r: 90 },
    ],
    anchors: {
      bar: { pos: [2.05, -2.45], rotY: 180, approach: [2.05, -1.7], seat: true, label: "Bar", icon: "◐" },
      booth: { pos: [-4.7, -2.45], rotY: 0, approach: [-3.25, -2.45], seat: true, label: "Booth", icon: "◫" },
      quiz: { pos: [0.6, 2.35], rotY: 180, seat: true, label: "Quiz table", icon: "?" },
      screen: { pos: [-2.0, -2.9], rotY: -145, label: "Big screen", icon: "▣" },
      darts: { pos: [-0.9, -2.7], rotY: 180, label: "Darts", icon: "◎" },
      wc: { pos: [-5.9, -0.15], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.8, 3.7], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "sam", appearance: { body: 0, skin: 1, hairStyle: 5, hairColour: 1, top: 4, bottom: 2, shoes: 2 }, outfit: { top: 2 }, pos: [2.6, -3.85], rotY: 0, pose: "work" }],
    extras: [
      { seed: 91, pos: [3.55, -2.45], rotY: 180, pose: "sit" },
      { seed: 92, pos: [-4.7, 0.85], rotY: 0, pose: "eat" },
      { seed: 93, pos: [-4.7, 2.15], rotY: 180, pose: "sit" },
      { seed: 94, pos: [-2.6, -2.2], rotY: -150, pose: "celebrate" },
    ],
    walkers: 1,
    spawn: [-5.4, 3.7],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ murmur: 0.9, room: 0.2 }),
  },

  afterlight: {
    shell: { size: [13, 9], floor: { kind: "rubber", c1: "#1a1622", c2: "#3a2a4a" }, back: { kind: "plaster", c: "#221a2e", c2: "#7a3f8f" }, left: { kind: "plaster", c: "#2a1f36", c2: "#7a3f8f" } },
    props: [
      { t: "dance_floor", p: [0, -0.4], w: 5, d: 4 },
      { t: "dj_booth", p: [0, -3.6] },
      { t: "speaker", p: [-3.0, -3.8] },
      { t: "speaker", p: [3.0, -3.8] },
      { t: "bar", p: [4.95, 1.0], r: -90, w: 4, c: "#2a1f36" },
      { t: "neon", p: [0, -4.45], text: "Afterlight", c: "#ff6fae", y: 2.7, h: 0.7 },
      { t: "booth", p: [-4.8, 2.6], w: 2, c: "#7a3f8f" },
      { t: "wc_door", p: [-6.46, -1.5], r: 90 },
      { t: "door", p: [-6.46, 0.9], r: 90 },
    ],
    anchors: {
      floor: { pos: [0.4, 0.1], rotY: 180, label: "Dance floor", icon: "★" },
      bar: { pos: [4.2, 0.4], rotY: 90, approach: [3.5, 0.4], seat: true, label: "Bar", icon: "◐" },
      booth: { pos: [0.9, -2.6], rotY: 180, label: "DJ booth", icon: "♫" },
      wc: { pos: [-5.9, -1.5], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.8, 0.9], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "nova", appearance: { body: 1, skin: 5, hairStyle: 1, hairColour: 4, top: 5, bottom: 0, shoes: 3 }, outfit: { top: 3, glasses: true }, pos: [0, -4.15], rotY: 0, pose: "work" }],
    extras: [
      { seed: 101, pos: [-1.6, -1.2], rotY: 170, pose: "dance" },
      { seed: 102, pos: [1.7, -0.9], rotY: 200, pose: "dance" },
      { seed: 103, pos: [-0.8, 1.0], rotY: 150, pose: "dance" },
      { seed: 104, pos: [1.3, 1.2], rotY: 210, pose: "dance" },
      { seed: 105, pos: [-4.8, 1.95], rotY: 180, pose: "sit" },
    ],
    walkers: 1,
    spawn: [-5.4, 0.9],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: { layers: { club: 0.9, murmur: 0.3 }, music: "club" },
  },

  south_bank: {
    shell: { size: [18, 12], floor: { kind: "stone", c1: "#b9b3a8", c2: "#a7a196" }, outdoor: true },
    props: [
      { t: "river", p: [0, -6.6], w: 40, d: 5 },
      { t: "skyline", p: [0, -30], w: 70 },
      { t: "railing", p: [0, -3.95], w: 18 },
      { t: "tree", p: [-6.2, 2.6], v: 1 },
      { t: "tree", p: [5.2, 3.8], h: 0.9 },
      { t: "tree", p: [8.0, -1.0], v: 3 },
      { t: "lamp_post", p: [-7.4, -3.4] },
      { t: "lamp_post", p: [-2.4, -3.4] },
      { t: "lamp_post", p: [2.6, -3.4] },
      { t: "lamp_post", p: [7.4, -3.4] },
      { t: "busk_pitch", p: [-3, 0] },
      { t: "bench", p: [4.0, 1.8], r: 180 },
      { t: "bench", p: [0.6, 1.8], r: 180 },
      { t: "stall", p: [6.6, 3.4], w: 1.6, c: "#C69C58", text: "Doughnuts" },
      { t: "stall", p: [-6.6, 4.4], w: 2.2, v: 1, c: "#2F4A6B", text: "Books" },
    ],
    anchors: {
      railing: { pos: [0.6, -3.35], rotY: 180, label: "River railings", icon: "≈" },
      pitch: { pos: [-3, 0], rotY: 0, label: "Busking pitch", icon: "♪" },
      steps: { pos: [4.0, 1.85], rotY: 180, approach: [4.0, 1.0], seat: true, label: "Riverside bench", icon: "☀" },
      cart: { pos: [6.6, 4.4], rotY: 180, label: "Snack cart", icon: "◐" },
      exit: { pos: [-8.3, 2.0], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "lena", appearance: { body: 1, skin: 0, hairStyle: 4, hairColour: 3, top: 3, bottom: 1, shoes: 1 }, outfit: { top: 1, bottom: 2, scarf: true }, pos: [-4.5, 0.7], rotY: 45, pose: "strum" }],
    extras: [{ seed: 111, pos: [3.0, -3.35], rotY: 180, pose: "photo" }],
    walkers: 4,
    spawn: [-7.6, 2.0],
    camera: { pos: [6, 8, 12], target: [0, 0.8, -0.5] },
    sound: calm({ water: 0.6, city: 0.35, wind: 0.25 }),
  },

  borough_market: {
    shell: { size: [15, 10], floor: { kind: "stone", c1: "#a8a196", c2: "#958f85" }, back: { kind: "brick", c: "#7c4337" }, outdoor: true },
    props: [
      { t: "stall", p: [-4.5, -3.3], w: 2.8, c: "#234C42", text: "Dele's Produce" },
      { t: "stall", p: [-0.8, -3.3], w: 2.6, v: 1, c: "#BC3D3B", text: "Arch 7 Kitchen" },
      { t: "stall", p: [3.0, -3.3], w: 2.6, c: "#C69C58", text: "Spice & Grain" },
      { t: "stall", p: [5.9, 1.6], r: -90, w: 2.6, v: 1, c: "#7a3f8f", text: "Vintage" },
      { t: "clothes_rail", p: [5.4, 3.9], r: -90 },
      { t: "crate", p: [-6.2, -2.7] },
      { t: "crate", p: [1.2, -2.6], c: "#7a5134" },
      { t: "cafe_table", p: [-2.0, 1.6] },
      { t: "cafe_table", p: [0.9, 2.3] },
      { t: "bunting", p: [0, -1.2], w: 14, y: 3.3 },
      { t: "kiosk", p: [-6.5, 0.8], r: 90 },
      { t: "lamp_post", p: [3.5, 4.2] },
    ],
    anchors: {
      stall: { pos: [-4.5, -2.35], rotY: 180, label: "Dele's stall", icon: "◉" },
      food: { pos: [-0.8, -2.35], rotY: 180, label: "Street food", icon: "◐" },
      groceries: { pos: [3.0, -2.35], rotY: 180, label: "Ingredients", icon: "▤" },
      vintage: { pos: [4.9, 1.6], rotY: 90, label: "Vintage stalls", icon: "✦" },
      wc: { pos: [-5.65, 0.8], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-7.0, 4.2], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "dele", appearance: { body: 0, skin: 5, hairStyle: 0, hairColour: 0, top: 0, bottom: 2, shoes: 2 }, outfit: { top: 0, hat: 2 }, pos: [-4.5, -4.1], rotY: 0, pose: "work" }],
    extras: [
      { seed: 121, pos: [0.4, -2.2], rotY: 160, pose: "idle" },
      { seed: 122, pos: [2.0, -2.2], rotY: 190, pose: "phone" },
      { seed: 123, pos: [-2.0, 2.15], rotY: 180, pose: "eat" },
    ],
    walkers: 4,
    spawn: [-6.4, 4.2],
    camera: { pos: [6, 8, 12], target: [0, 0.8, -0.5] },
    sound: calm({ murmur: 0.85, city: 0.3 }),
  },

  borough_athletics: {
    shell: { size: [13, 9], floor: { kind: "rubber", c1: "#2b2f36", c2: "#BC3D3B" }, back: { kind: "plaster", c: "#e8e8e4", c2: "#BC3D3B" }, left: { kind: "plaster", c: "#dfe0dc", c2: "#BC3D3B" } },
    props: [
      { t: "mirror", p: [-2.4, -4.45], w: 3.2, h: 1.6, y: 1.5 },
      { t: "rack", p: [-2.4, -4.1], w: 2.6 },
      { t: "weight_bench", p: [-3.6, -2.4] },
      { t: "weight_bench", p: [-1.2, -2.4], c: "#2F4A6B" },
      { t: "treadmill", p: [2.2, -3.2] },
      { t: "treadmill", p: [3.4, -3.2] },
      { t: "treadmill", p: [4.6, -3.2] },
      { t: "yoga_mat", p: [2.0, 1.6], c: "#2f8a5f" },
      { t: "yoga_mat", p: [3.2, 1.6], c: "#7a3f8f" },
      { t: "yoga_mat", p: [4.4, 1.6], c: "#C69C58" },
      { t: "reception", p: [-4.2, 2.6], c: "#BC3D3B" },
      { t: "water_cooler", p: [-2.9, 3.6] },
      { t: "plant", p: [5.9, 3.8] },
      { t: "door", p: [-6.46, -1.8], r: 90, text: "Showers", c: "#4d8fa8" },
      { t: "wc_door", p: [-6.46, 0.4], r: 90 },
      { t: "door", p: [-6.46, 3.9], r: 90 },
    ],
    anchors: {
      weights: { pos: [-2.4, -1.1], rotY: 180, label: "Weights", icon: "◆" },
      treadmill: { pos: [3.4, -3.05], rotY: 180, y: 0.27, approach: [3.4, -1.9], label: "Treadmills", icon: "➜" },
      studio: { pos: [3.2, 1.6], rotY: 180, label: "Yoga studio", icon: "✿" },
      shower: { pos: [-5.9, -1.8], rotY: -90, label: "Showers", icon: "◇" },
      desk: { pos: [-4.2, 3.6], rotY: 180, label: "Front desk", icon: "◉" },
      wc: { pos: [-5.9, 0.4], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.8, 3.95], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "tia", appearance: { body: 1, skin: 3, hairStyle: 2, hairColour: 0, top: 1, bottom: 0, shoes: 0 }, outfit: { top: 0, bottom: 3 }, pos: [-0.3, -1.3], rotY: 210, pose: "talk" }],
    extras: [
      { seed: 131, pos: [2.2, -3.05], rotY: 180, pose: "jog", y: 0.27 },
      { seed: 132, pos: [4.4, 1.6], rotY: 180, pose: "yoga" },
      { seed: 133, pos: [-3.6, -1.2], rotY: 180, pose: "lift" },
    ],
    spawn: [-5.4, 3.95],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ room: 0.3, murmur: 0.2 }),
  },

  crown_and_curl: {
    shell: { size: [11, 8], floor: { kind: "checker", c1: "#f2efe9", c2: "#d9c9d0" }, back: { kind: "plaster", c: "#f1dfe4", c2: "#7a3f8f" }, left: { kind: "plaster", c: "#e9d3da", c2: "#7a3f8f" } },
    props: [
      { t: "mirror", p: [-2.5, -3.95], w: 1.0, h: 1.3, y: 1.5 },
      { t: "mirror", p: [0, -3.95], w: 1.0, h: 1.3, y: 1.5 },
      { t: "mirror", p: [2.5, -3.95], w: 1.0, h: 1.3, y: 1.5 },
      { t: "salon_chair", p: [-2.5, -2.8], r: 180 },
      { t: "salon_chair", p: [0, -2.8], r: 180, c: "#BC3D3B" },
      { t: "salon_chair", p: [2.5, -2.8], r: 180 },
      { t: "basin", p: [4.6, -3.4] },
      { t: "cafe_table", p: [3.4, 1.0], c: "#e9d3da" },
      { t: "sofa", p: [-2.9, 1.9], w: 2.2, c: "#7a3f8f" },
      { t: "plant", p: [5.0, 3.4] },
      { t: "pendant", p: [0, -1.6], c: "#7a3f8f" },
      { t: "neon", p: [3.0, -3.95], text: "Crown & Curl", c: "#c69c58", y: 2.75, h: 0.45 },
      { t: "wc_door", p: [-5.46, -1.0], r: 90 },
      { t: "door", p: [-5.46, 3.0], r: 90 },
    ],
    anchors: {
      chairs: { pos: [0, -2.75], rotY: 180, approach: [0.6, -1.7], seat: true, label: "Styling chairs", icon: "✂" },
      nails: { pos: [3.4, 1.55], rotY: 180, approach: [3.4, 2.2], seat: true, label: "Nail bar", icon: "✦" },
      sofa: { pos: [-2.9, 1.95], rotY: 0, approach: [-2.9, 2.85], seat: true, label: "Waiting sofa", icon: "☺" },
      wc: { pos: [-4.9, -1.0], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-4.8, 3.0], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "precious", appearance: { body: 1, skin: 4, hairStyle: 3, hairColour: 4, top: 4, bottom: 0, shoes: 3 }, outfit: { top: 2 }, pos: [-0.9, -2.15], rotY: 160, pose: "work" }],
    extras: [
      { seed: 141, pos: [-2.5, -2.75], rotY: 180, pose: "sit" },
      { seed: 142, pos: [2.5, -2.75], rotY: 180, pose: "sit" },
      { seed: 143, pos: [2.0, -2.1], rotY: 200, pose: "work" },
    ],
    spawn: [-4.4, 3.0],
    camera: { pos: [5, 7, 9], target: [0, 0.8, -0.3] },
    sound: calm({ murmur: 0.5, room: 0.2 }),
  },

  borough_health: {
    shell: { size: [12, 9], floor: { kind: "tiles", c1: "#e7eef0", c2: "#d5e1e5" }, back: { kind: "plaster", c: "#eef3f3", c2: "#2F8A7F" }, left: { kind: "plaster", c: "#e4ecec", c2: "#2F8A7F" } },
    props: [
      { t: "reception", p: [-3.6, -1.6], c: "#2F8A7F" },
      { t: "sign", p: [-3.6, -4.47], text: "Borough Health Centre", y: 2.7, w: 3.6, h: 0.5, c: "#2F8A7F" },
      { t: "counter", p: [3.8, -3.4], w: 3, c: "#e9eef0" },
      { t: "shelf", p: [3.8, -4.25], w: 3, c: "#d8dcdf" },
      { t: "sign", p: [3.8, -4.47], text: "Pharmacy", y: 2.6, w: 2, h: 0.4, c: "#2F8A7F" },
      { t: "door", p: [0.4, -4.44], text: "Nurse", c: "#2F8A7F" },
      { t: "bench", p: [-0.8, 1.8], r: 180 },
      { t: "bench", p: [1.8, 1.8], r: 180 },
      { t: "noticeboard", p: [-1.4, -4.45], w: 1.6, y: 1.6 },
      { t: "water_cooler", p: [4.9, 1.6] },
      { t: "plant", p: [5.3, 3.6] },
      { t: "plant", p: [-5.3, -3.9] },
      { t: "pendant", p: [0, 0], c: "#2F8A7F" },
      { t: "wc_door", p: [-5.96, 0.6], r: 90 },
      { t: "door", p: [-5.96, 3.3], r: 90 },
    ],
    anchors: {
      reception: { pos: [-3.6, -0.75], rotY: 180, label: "Reception", icon: "◉" },
      consult: { pos: [0.4, -3.8], rotY: 180, label: "Nurse's room", icon: "✚" },
      pharmacy: { pos: [3.8, -2.55], rotY: 180, label: "Pharmacy", icon: "◆" },
      waiting: { pos: [1.8, 1.85], rotY: 180, approach: [1.8, 1.0], seat: true, label: "Waiting room", icon: "☾" },
      wc: { pos: [-5.4, 0.6], rotY: -90, label: "Toilets", icon: "▽" },
      exit: { pos: [-5.3, 3.3], rotY: -90, label: "Leave", icon: "⌖" },
    },
    npcs: [{ id: "ade", appearance: { body: 0, skin: 4, hairStyle: 0, hairColour: 0, top: 4, bottom: 3, shoes: 0 }, outfit: { top: 2 }, pos: [-3.6, -2.3], rotY: 0, pose: "talk" }],
    extras: [
      { seed: 151, pos: [-0.8, 1.85], rotY: 180, pose: "phone" },
      { seed: 152, pos: [-0.2, 1.85], rotY: 180, pose: "read" },
      { seed: 153, pos: [3.8, -2.4], rotY: 180, pose: "idle" },
    ],
    spawn: [-4.8, 3.3],
    camera: { pos: [5, 7, 10], target: [0, 0.8, -0.3] },
    sound: calm({ room: 0.35, murmur: 0.2 }),
  },
  ...LAYOUTS_A,
};
