/** Extra venue prop types for venues part B (stadium, hotel, jetty, golf, bikes, build yard, terminal, civic). Pure data. */
import type { PropSpec } from "./props";

export const PROP_TYPES_B = [
  "stands",
  "goal",
  "pool",
  "massage_table",
  "hotel_bed",
  "boat",
  "golf_flag",
  "bike",
  "lumber",
  "plane",
  "ballot_booth",
  "podium",
  "van",
] as const;
export type PropTypeB = (typeof PROP_TYPES_B)[number];

const SET = new Set<string>(PROP_TYPES_B);
export const isPropB = (t: string): t is PropTypeB => SET.has(t);

/** Walk-blocking footprint [width, depth] at rotation 0, or null for decorations you can walk past. */
export function propBlockB(s: Pick<PropSpec, "w" | "d"> & { t: PropTypeB }): [number, number] | null {
  switch (s.t) {
    case "stands":
      return [s.w ?? 8, Math.round(s.d ?? 3)];
    case "pool":
      return [(s.w ?? 6) + 0.4, (s.d ?? 3) + 0.4];
    case "massage_table":
      return [0.8, 2.0];
    case "hotel_bed":
      return [1.8, 2.2];
    case "boat":
      return [s.w ?? 8, 2.6];
    case "bike":
      return [1.7, 0.5];
    case "lumber":
      return [s.w ?? 2.2, 1.0];
    case "ballot_booth":
      return [0.9, 0.9];
    case "podium":
      return [0.6, 0.5];
    case "van":
      return [s.w ?? 3.6, 1.8];
    case "goal":
    case "golf_flag":
    case "plane":
      return null;
  }
}
