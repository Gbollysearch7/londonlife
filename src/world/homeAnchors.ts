import { furnitureDef } from "@/content/catalogue";
import { activityDef } from "@/content/world";
import { footprint, type Placed } from "@/sim/placement";
import { blockRect, makeGrid, type NavGrid, type P2 } from "./nav";
import { visualFor, type Visual } from "./activityVisuals";
import { standingVariant } from "./poses";

/** A resolved spot in the home: radians, world coordinates (room centred on the origin). */
export interface HomeSpot {
  pos: P2;
  rotY: number;
  approach: P2;
  seat: boolean;
  visual: Visual;
  furnitureId: string | null;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function cellCentre(p: Placed, gridW: number, gridD: number): P2 {
  const fp = footprint(p.defId, p.rot);
  return [p.x + fp.w / 2 - gridW / 2, p.y + fp.d / 2 - gridD / 2];
}

/** Walkable grid for the home: floor furniture blocks its full footprint; rugs and wall items don't. */
export function homeGrid(placed: Placed[], gridW: number, gridD: number): NavGrid {
  const g = makeGrid(gridW, gridD, 0.5);
  for (const p of placed) {
    const fp = footprint(p.defId, p.rot);
    if (fp.surface !== "floor") continue;
    const x0 = p.x - gridW / 2;
    const z0 = p.y - gridD / 2;
    blockRect(g, x0, z0, x0 + fp.w, z0 + fp.d);
  }
  return g;
}

const has = (p: Placed, tag: string) => furnitureDef(p.defId)?.enables.includes(tag) ?? false;
const isSeat = (p: Placed) => has(p, "seat");

/** The standing/sitting/lying spot for using a specific piece of furniture in a given way. */
export function spotAt(p: Placed, gridW: number, gridD: number, how: "lie" | "sit" | "desk" | "inside" | "use"): Omit<HomeSpot, "visual"> {
  const [cx, cz] = cellCentre(p, gridW, gridD);
  const def = furnitureDef(p.defId)!;
  const r = rad(p.rot);
  const f: P2 = [Math.sin(r), Math.cos(r)];
  const depth = def.d;
  const at = (k: number): P2 => [cx + f[0] * k, cz + f[1] * k];
  switch (how) {
    case "lie":
      if (has(p, "bed")) return { pos: at(0.85), rotY: r, approach: at(depth / 2 + 0.5), seat: true, furnitureId: p.id };
      // Lying along a sofa: feet at one arm, head at the other.
      return { pos: [cx + Math.cos(r) * 0.8, cz - Math.sin(r) * 0.8], rotY: r + Math.PI / 2, approach: at(depth / 2 + 0.5), seat: true, furnitureId: p.id };
    case "sit":
      return { pos: at(0.06), rotY: r, approach: at(depth / 2 + 0.5), seat: true, furnitureId: p.id };
    case "desk":
      return { pos: at(0.5), rotY: r + Math.PI, approach: at(1.15), seat: true, furnitureId: p.id };
    case "inside":
      return { pos: [cx, cz], rotY: r, approach: at(depth / 2 + 0.45), seat: false, furnitureId: p.id };
    case "use": {
      const reach = depth / 2 + 0.38;
      const pos = at(reach);
      return { pos, rotY: r + Math.PI, approach: pos, seat: false, furnitureId: p.id };
    }
  }
}

/** Resolves where an activity happens in the home and how it looks there. */
export function homeSpot(activityId: string, placed: Placed[], gridW: number, gridD: number): HomeSpot | null {
  const def = activityDef(activityId);
  if (!def) return null;
  const visual = visualFor(activityId);
  const seat = placed.find(isSeat);
  const first = (tag: string) => placed.find((p) => has(p, tag));
  const make = (s: Omit<HomeSpot, "visual"> | null, v: Visual = visual): HomeSpot | null => {
    if (!s) return null;
    const vis = v.seated && !s.seat ? { ...v, ...standingVariant(v.pose) } : v;
    return { ...s, visual: vis };
  };

  if (activityId === "sleep") {
    const bed = first("bed");
    return bed ? make(spotAt(bed, gridW, gridD, "lie")) : null;
  }
  if (activityId === "nap") {
    const bed = first("bed") ?? first("nap");
    return bed ? make(spotAt(bed, gridW, gridD, "lie")) : null;
  }
  if (activityId === "shower" || activityId === "toilet") {
    const it = first(activityId);
    return it ? make(spotAt(it, gridW, gridD, "inside")) : null;
  }
  if (activityId === "coding_sprint_home" || activityId === "workstation_sprint") {
    const desk = first(activityId === "workstation_sprint" ? "workstation" : "desk");
    return desk ? make(spotAt(desk, gridW, gridD, "desk")) : null;
  }
  // Seated-by-preference activities: use a chair or sofa when there is one, otherwise stand at the item.
  if (activityId === "watch_tv" || activityId === "watch_cinema" || activityId === "relax" || activityId.startsWith("read_") || activityId === "practise_guitar" || activityId.startsWith("eat_")) {
    if (seat) return make(spotAt(seat, gridW, gridD, "sit"));
    const fallback = def.requires ? first(def.requires) : first("fridge") ?? first("hob");
    if (fallback) return make({ ...spotAt(fallback, gridW, gridD, "use"), seat: false });
    return null;
  }
  const item = def.requires ? first(def.requires) : null;
  return item ? make(spotAt(item, gridW, gridD, "use")) : null;
}

/** Actions to offer when the player taps a piece of furniture. */
export function furnitureActionIds(defId: string, actions: { id: string; hidden?: boolean }[]): string[] {
  const def = furnitureDef(defId);
  if (!def) return [];
  const tags = new Set(def.enables);
  return actions
    .filter((a) => {
      if (a.hidden) return false;
      const ad = activityDef(a.id);
      if (!ad || ad.location !== "home") return false;
      if (ad.requires && tags.has(ad.requires)) return true;
      // Meals you've cooked live in the fridge and are eaten sitting down.
      if (ad.id.startsWith("eat_") && (tags.has("fridge") || tags.has("seat"))) return true;
      return false;
    })
    .map((a) => a.id);
}
