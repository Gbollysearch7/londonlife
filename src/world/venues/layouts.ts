import type { Appearance } from "@/content/character";
import type { Scene } from "@/client/sound";
import type { Outfit } from "../Avatar";
import type { Pose, Prop } from "../poses";
import type { PropSpec, Shell } from "./props";

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
};
