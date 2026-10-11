"use client";
import { PARTY_IDS } from "@/content/household";
import type { State } from "@/client/api";
import Avatar from "./Avatar";
import { appearanceFromSeed } from "./Crowd";
import { TextLabel } from "./TextLabel";
import { LAYOUTS } from "./venues/layouts";

/** The authored look of a named local, wherever they appear (falls back to a seeded look). */
function npcLook(id: string, i: number) {
  for (const layout of Object.values(LAYOUTS)) {
    const n = layout.npcs.find((x) => x.id === id);
    if (n) return { appearance: n.appearance, outfit: n.outfit };
  }
  return appearanceFromSeed(900 + i);
}

/** NPC friends dancing at your house party, each clearly labelled as an NPC (never presented as players). */
export function PartyGuests({ state }: { state: State }) {
  if (!state.activity || !PARTY_IDS.includes(state.activity.defId)) return null;
  const guests = state.household.party.guests;
  const { gridW, gridD } = state.home.tier;
  const r = Math.min(gridW, gridD) * 0.28;
  return (
    <>
      {guests.map((g, i) => {
        const a = (i / Math.max(1, guests.length)) * Math.PI * 2 + 0.6;
        const pos: [number, number, number] = [Math.cos(a) * r, 0, Math.sin(a) * r + 0.4];
        const look = npcLook(g.id, i);
        return (
          <group key={g.id} position={pos} rotation={[0, -a - Math.PI / 2, 0]}>
            <Avatar appearance={look.appearance} outfit={look.outfit} pose="dance" mood="happy" phase={i * 0.7} />
            <group rotation={[0, a + Math.PI / 2, 0]}>
              <TextLabel text={g.name} sub="· NPC" position={[0, 2.25, 0]} height={0.32} />
            </group>
          </group>
        );
      })}
    </>
  );
}
