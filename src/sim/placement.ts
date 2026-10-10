import { furnitureDef } from "@/content/catalogue";
import type { Surface } from "@/content/types";

export interface Placed {
  id: string;
  defId: string;
  x: number;
  y: number;
  rot: number;
}

export function footprint(defId: string, rot: number) {
  const def = furnitureDef(defId);
  if (!def) throw new Error(`Unknown furniture ${defId}`);
  const swapped = rot === 90 || rot === 270;
  return { w: swapped ? def.d : def.w, d: swapped ? def.w : def.d, surface: def.surface };
}

function layer(surface: Surface) {
  return surface === "floor" ? "floor" : surface === "overlay" ? "overlay" : "wall";
}

/**
 * Validates a placement on the home grid.
 * - floor and overlay items must fit inside the grid; collisions are checked within the same layer only
 *   (a rug lies under a sofa; two sofas cannot overlap).
 * - wall items hang on the back wall (y = 0, rot 0) or the left wall (x = 0, rot 90).
 * Returns null when valid, otherwise a human-readable reason.
 */
export function placementError(
  candidate: Placed,
  others: Placed[],
  gridW: number,
  gridD: number,
): string | null {
  if (![0, 90, 180, 270].includes(candidate.rot)) return "Rotation must be 0, 90, 180 or 270.";
  const fp = footprint(candidate.defId, candidate.rot);
  if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y)) return "Position must be a grid cell.";
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + fp.w > gridW || candidate.y + fp.d > gridD) {
    return "Doesn't fit inside the room there.";
  }
  if (fp.surface === "wall") {
    const onBack = candidate.rot === 0 && candidate.y === 0;
    const onLeft = candidate.rot === 90 && candidate.x === 0;
    if (!onBack && !onLeft) return "Wall items must hang on a wall: back wall facing forward, or left wall turned 90°.";
  }
  const myLayer = layer(fp.surface);
  for (const o of others) {
    if (o.id === candidate.id) continue;
    const ofp = footprint(o.defId, o.rot);
    if (layer(ofp.surface) !== myLayer) continue;
    if (myLayer === "wall") {
      // Different walls never collide.
      if (o.rot !== candidate.rot) continue;
    }
    const overlap =
      candidate.x < o.x + ofp.w && candidate.x + fp.w > o.x && candidate.y < o.y + ofp.d && candidate.y + fp.d > o.y;
    if (overlap) return `Blocked by ${furnitureDef(o.defId)?.name ?? "another item"}.`;
  }
  return null;
}

/** Finds the first free valid spot, scanning row by row. Used for starter homes. */
export function firstFreeSpot(defId: string, others: Placed[], gridW: number, gridD: number): Placed | null {
  const def = furnitureDef(defId)!;
  const rots = def.surface === "wall" ? [0, 90] : [0, 90];
  for (const rot of rots) {
    for (let y = 0; y < gridD; y++) {
      for (let x = 0; x < gridW; x++) {
        const c = { id: "_", defId, x, y, rot };
        if (!placementError(c, others, gridW, gridD)) return c;
      }
    }
  }
  return null;
}
