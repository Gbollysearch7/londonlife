"use client";
import { useMemo, useState } from "react";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { furnitureDef } from "@/content/catalogue";
import type { State } from "@/client/api";
import type { Placed } from "@/sim/placement";
import Avatar from "./Avatar";
import { FurnitureModel } from "./furnitureModels";
import { cellCentre } from "./homeAnchors";
import { Room } from "./HomeScene";
import type { Lighting } from "./lighting";
import { SceneLights, SkyDome } from "./sceneParts";
import { TextLabel } from "./TextLabel";

type Visit = NonNullable<State["social"]["visit"]>;

const deg = (r: number) => (r * Math.PI) / 180;

/** One of the host's items: look, don't touch. Hover shows its name only. */
function ViewOnlyItem({ p, colour }: { p: Placed; colour: string }) {
  const def = furnitureDef(p.defId);
  const [hover, setHover] = useState(false);
  if (!def) return null;
  return (
    <group onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
      <FurnitureModel defId={def.id} colour={colour} w={def.w} d={def.d} />
      {hover && <TextLabel text={def.name} position={[0, 1.9, 0]} height={0.26} />}
    </group>
  );
}

/**
 * A friend's real home, read-only: their room size and furniture exactly as placed.
 * Nothing here is interactive beyond looking around; the server never lets a guest use or move the host's things.
 */
export default function VisitScene({ visit, state, light }: { visit: Visit; state: State; light: Lighting }) {
  const { gridW, gridD } = visit.home;
  const placed: Placed[] = useMemo(() => visit.furniture.map((f) => ({ id: f.id, defId: f.defId, x: f.x, y: f.y, rot: f.rot })), [visit.furniture]);
  const dist = Math.max(gridW, gridD);
  const door: [number, number] = [-gridW / 2 + 0.7, -0.5];
  return (
    <>
      <SkyDome light={light} />
      <fog attach="fog" args={[light.fog, dist * 3, dist * 7]} />
      <SceneLights light={light} size={dist * 1.4} />
      <Room gridW={gridW} gridD={gridD} light={light} weather={state.weather.id} />
      {placed.map((p) => {
        const f = visit.furniture.find((x) => x.id === p.id)!;
        const [cx, cz] = cellCentre(p, gridW, gridD);
        return (
          <group key={p.id} position={[cx, 0, cz]} rotation={[0, deg(p.rot), 0]}>
            <ViewOnlyItem p={p} colour={f.colour} />
          </group>
        );
      })}
      {/* You, just inside the door. */}
      <group position={[door[0], 0, door[1]]} rotation={[0, Math.PI / 2, 0]}>
        <Avatar appearance={state.character.appearance} pose="idle" mood="happy" />
        <TextLabel text={state.character.name} sub="you · guest" position={[0, 2.05, 0]} height={0.22} />
      </group>
      {/* The host appears only when presence says they're actually online. */}
      {visit.hostOnline && (
        <group position={[door[0] + 1.1, 0, door[1] + 0.6]} rotation={[0, -Math.PI / 2, 0]}>
          <Avatar appearance={visit.hostAppearance} pose="idle" mood="happy" phase={1.3} />
          <TextLabel text={visit.hostName} sub="player · online · host" position={[0, 2.05, 0]} height={0.22} />
        </group>
      )}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={dist * 1.5} blur={2} far={3} resolution={512} />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        minDistance={dist * 0.9}
        maxDistance={dist * 3.2}
        minPolarAngle={0.55}
        maxPolarAngle={1.15}
        minAzimuthAngle={0.05}
        maxAzimuthAngle={1.45}
        enableDamping
      />
    </>
  );
}
