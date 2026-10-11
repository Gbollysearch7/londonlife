import type { State } from "@/client/api";
import { furnitureDef } from "@/content/catalogue";
import { activityDef, venue } from "@/content/world";
import { cellCentre, furnitureActionIds } from "./homeAnchors";
import type { Hotspot } from "./sceneStore";
import { LAYOUTS } from "./venues/layouts";

/**
 * Everything you can tap in the current 3D scene, as a plain list (spec ch. 36: an accessible directory
 * supplements the 3D view). It mirrors exactly what HomeScene and VenueScene make clickable, so every
 * in-world action is reachable by keyboard or screen reader without touching the canvas.
 */
export type DirectoryEntry =
  | { key: string; kind: "hotspot"; label: string; detail: string; hotspot: Hotspot }
  | { key: string; kind: "map"; label: string; detail: string }
  | { key: string; kind: "treasure"; label: string; detail: string };

function detailFor(state: State, actionIds: string[], fallback: string) {
  const acts = state.actions.filter((a) => actionIds.includes(a.id) && !a.hidden);
  if (!acts.length) return fallback;
  const ready = acts.filter((a) => a.available).length;
  const names = acts.slice(0, 3).map((a) => a.label).join(", ");
  return `${names}${acts.length > 3 ? "…" : ""} · ${ready} of ${acts.length} available`;
}

export function sceneHotspots(state: State, opts: { placingId?: string | null } = {}): DirectoryEntry[] {
  if (state.journey || state.social?.visit) return [];
  const out: DirectoryEntry[] = [];
  const loc = state.character.location;

  if (loc === "home") {
    const { gridW, gridD } = state.home.tier;
    for (const f of state.furniture) {
      if (!f.placed || f.x === null || f.y === null || f.id === opts.placingId) continue;
      const def = furnitureDef(f.defId);
      if (!def) continue;
      const [cx, cz] = cellCentre({ id: f.id, defId: f.defId, x: f.x, y: f.y!, rot: f.rot }, gridW, gridD);
      const actionIds = furnitureActionIds(def.id, state.actions);
      out.push({
        key: f.id,
        kind: "hotspot",
        label: def.name,
        detail: detailFor(state, actionIds, "Move or store it"),
        hotspot: { id: f.id, title: def.name, subtitle: def.blurb, position: [cx, 0, cz], actionIds, furnitureId: f.id },
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    out.push({ key: "head-out", kind: "map", label: "Head out", detail: "Open the map to travel" });
    return out;
  }

  const layout = LAYOUTS[loc] ?? LAYOUTS.food_hall;
  const v = venue(loc);
  for (const n of layout.npcs) {
    const npc = v?.npcs.find((x) => x.id === n.id);
    const actionIds = state.actions.filter((a) => a.npc === n.id).map((a) => a.id);
    const name = npc?.name ?? n.id;
    out.push({
      key: `npc:${n.id}`,
      kind: "hotspot",
      label: `${name} (NPC)`,
      detail: detailFor(state, actionIds, npc?.role ?? "Say hello"),
      hotspot: { id: `npc:${n.id}`, title: name, subtitle: npc?.role, position: [n.pos[0], 0, n.pos[1]], actionIds },
    });
  }
  const anchorActions: Record<string, string[]> = {};
  for (const a of state.actions) {
    if (a.npc || a.hidden) continue;
    const anchor = activityDef(a.id)?.anchor;
    if (anchor) (anchorActions[anchor] ??= []).push(a.id);
  }
  for (const [id, a] of Object.entries(layout.anchors)) {
    if (!a.label) continue;
    const actionIds = anchorActions[id] ?? [];
    const special = id === "exit" || id === "groceries" || id === "chairs";
    if (!actionIds.length && !special) continue;
    out.push({
      key: `anchor:${id}`,
      kind: "hotspot",
      label: a.label,
      detail: id === "exit" ? "Leave and pick where to go next" : id === "groceries" ? "Buy ingredients" : detailFor(state, actionIds, "Open"),
      hotspot: { id: `anchor:${id}`, title: a.label, position: [a.pos[0], 0, a.pos[1]], actionIds },
    });
  }
  if (state.treasure.anchor && layout.anchors[state.treasure.anchor] && !state.treasure.found) {
    out.push({ key: "treasure", kind: "treasure", label: "Today's treasure", detail: "It's hidden here. Claim it" });
  }
  return out;
}
