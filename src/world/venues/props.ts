/** Venue prop data: pure types and walk-blocking footprints (no rendering), shared by the kit and navigation. */
import { blockRect, makeGrid, type NavGrid } from "../nav";
import type { FloorKind } from "../textures";

export interface PropSpec {
  t: PropType;
  p: [number, number];
  /** Rotation about Y in degrees. */
  r?: number;
  c?: string;
  w?: number;
  d?: number;
  h?: number;
  y?: number;
  text?: string;
  /** Free-form variant index. */
  v?: number;
  /** Raise the whole prop (e.g. a drum kit on a stage). */
  lift?: number;
}

export type PropType =
  | "counter"
  | "kitchen_back"
  | "sign"
  | "long_table"
  | "round_table"
  | "cafe_table"
  | "shelf"
  | "pendant"
  | "plant"
  | "noticeboard"
  | "bunting"
  | "hatch"
  | "old_sofa"
  | "sofa"
  | "computer_desk"
  | "office_desk"
  | "reception"
  | "glass_pod"
  | "break_kitchen"
  | "door"
  | "wc_door"
  | "stage"
  | "bar"
  | "stool"
  | "speaker"
  | "dj_booth"
  | "dance_floor"
  | "treadmill"
  | "weight_bench"
  | "rack"
  | "yoga_mat"
  | "mirror"
  | "bookcase"
  | "reading_table"
  | "armchair"
  | "lamp_post"
  | "tree"
  | "bench"
  | "hedge"
  | "pond"
  | "pavilion"
  | "stall"
  | "river"
  | "railing"
  | "salon_chair"
  | "basin"
  | "whiteboard"
  | "lecture_seats"
  | "screen"
  | "dartboard"
  | "busk_pitch"
  | "crate"
  | "piano"
  | "drum_kit"
  | "mic_stand"
  | "skyline"
  | "planter"
  | "picnic_blanket"
  | "water_cooler"
  | "fridge_display"
  | "neon"
  | "booth"
  | "clothes_rail"
  | "pillar"
  | "paving"
  | "kiosk"
  | "court";

/** Walk-blocking footprint [width, depth] at rotation 0, or null for decorations you can walk past. */
export function propBlock(s: PropSpec): [number, number] | null {
  const w = s.w;
  const d = s.d;
  switch (s.t) {
    case "counter":
      return [w ?? 3, d ?? 0.8];
    case "kitchen_back":
      return [w ?? 3, 0.6];
    case "long_table":
      return [2.1, (d ?? 2.6) + 0.2];
    case "round_table":
      return [1.6, 1.6];
    case "cafe_table":
      return [1.2, 1.2];
    case "shelf":
      return [w ?? 2.6, 0.6];
    case "plant":
    case "planter":
      return [0.6, 0.6];
    case "hatch":
      return [w ?? 3, 0.8];
    case "old_sofa":
    case "sofa":
      return [w ?? 2.2, 0.95];
    case "computer_desk":
      return [w ?? 2.6, 1.0];
    case "office_desk":
      return [1.7, 1.5];
    case "reception":
      return [w ?? 1.9, 0.9];
    case "glass_pod":
      return [2.1, 2.1];
    case "break_kitchen":
      return [w ?? 2.3, 0.8];
    case "stage":
      return [w ?? 4, d ?? 2];
    case "bar":
      return [w ?? 4, 0.9];
    case "speaker":
      return [0.6, 0.6];
    case "dj_booth":
      return [1.8, 0.9];
    case "treadmill":
      return [0.9, 1.9];
    case "weight_bench":
      return [0.8, 1.7];
    case "rack":
      return [w ?? 1.8, 0.6];
    case "bookcase":
      return [w ?? 2, 0.5];
    case "reading_table":
      return [w ?? 2, 1.5];
    case "armchair":
      return [0.95, 0.95];
    case "lamp_post":
      return [0.3, 0.3];
    case "tree":
      return [0.7, 0.7];
    case "bench":
      return [1.7, 0.7];
    case "hedge":
      return [w ?? 3, 0.7];
    case "pond":
      return [w ?? 4, d ?? 3];
    case "stall":
      return [w ?? 2.4, 1.1];
    case "river":
      return [w ?? 20, d ?? 4];
    case "railing":
      return [w ?? 4, 0.2];
    case "salon_chair":
      return [0.9, 0.9];
    case "basin":
      return [0.8, 0.8];
    case "lecture_seats":
      return [w ?? 5, d ?? 3];
    case "crate":
      return [0.6, 0.6];
    case "piano":
      return [1.6, 0.7];
    case "water_cooler":
      return [0.45, 0.45];
    case "fridge_display":
      return [w ?? 1.2, 0.7];
    case "booth":
      return [w ?? 2, 1.6];
    case "clothes_rail":
      return [w ?? 1.8, 0.6];
    case "pillar":
      return [0.5, 0.5];
    case "kiosk":
      return [1.4, 1.2];
    case "paving":
    case "court":
      return null;
    case "pavilion":
    case "picnic_blanket":
    case "dance_floor":
    case "yoga_mat":
    case "busk_pitch":
    case "sign":
    case "pendant":
    case "noticeboard":
    case "bunting":
    case "door":
    case "wc_door":
    case "stool":
    case "mirror":
    case "whiteboard":
    case "screen":
    case "dartboard":
    case "drum_kit":
    case "mic_stand":
    case "skyline":
    case "neon":
      return null;
  }
}


/** Builds the walkable grid for a venue from its props, NPCs and extras. */
export function buildVenueGrid(size: [number, number], props: PropSpec[], people: [number, number][], cell = 0.5): NavGrid {
  const [w, d] = size;
  const g = makeGrid(w - 0.4, d - 0.4, cell);
  for (const p of props) {
    const b = propBlock(p);
    if (!b) continue;
    const a = ((p.r ?? 0) * Math.PI) / 180;
    // Axis-aligned bounds of the rotated footprint.
    const hw = (Math.abs(Math.cos(a)) * b[0] + Math.abs(Math.sin(a)) * b[1]) / 2;
    const hd = (Math.abs(Math.sin(a)) * b[0] + Math.abs(Math.cos(a)) * b[1]) / 2;
    blockRect(g, p.p[0] - hw, p.p[1] - hd, p.p[0] + hw, p.p[1] + hd, 0.12);
  }
  for (const [x, z] of people) blockRect(g, x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  return g;
}

export interface WallSpec {
  kind: "brick" | "plaster" | "panel" | "window" | "glass" | "none";
  c?: string;
  c2?: string;
}

export interface Shell {
  size: [number, number];
  floor: { kind: FloorKind; c1: string; c2: string };
  back?: WallSpec;
  left?: WallSpec;
  height?: number;
  outdoor?: boolean;
}

