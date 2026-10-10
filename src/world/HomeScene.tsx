"use client";
import { useMemo } from "react";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { furnitureDef } from "@/content/catalogue";
import { activityDef } from "@/content/world";
import type { State } from "@/client/api";
import { useGame, type Placement } from "@/client/store";
import { footprint, placementError, type Placed } from "@/sim/placement";
import Avatar, { type Pose } from "./Avatar";
import { FurnitureModel } from "./furnitureModels";
import type { Lighting } from "./lighting";

const deg = (r: number) => (r * Math.PI) / 180;

export function cellCentre(p: Placed, gridW: number, gridD: number) {
  const fp = footprint(p.defId, p.rot);
  return [p.x + fp.w / 2 - gridW / 2, p.y + fp.d / 2 - gridD / 2] as const;
}

const front = (rot: number) => [Math.sin(deg(rot)), Math.cos(deg(rot))] as const;

interface AvatarSpot {
  pos: [number, number, number];
  rotY: number;
  pose: Pose;
  hidden?: boolean;
}

function avatarSpot(state: State, placed: Placed[], gridW: number, gridD: number): AvatarSpot {
  const occupied = new Set<string>();
  for (const p of placed) {
    const fp = footprint(p.defId, p.rot);
    if (fp.surface !== "floor") continue;
    for (let dx = 0; dx < fp.w; dx++) for (let dy = 0; dy < fp.d; dy++) occupied.add(`${p.x + dx},${p.y + dy}`);
  }
  let idle: AvatarSpot = { pos: [0, 0, 0], rotY: 0, pose: "idle" };
  let best = Infinity;
  for (let y = 0; y < gridD; y++)
    for (let x = 0; x < gridW; x++) {
      if (occupied.has(`${x},${y}`)) continue;
      const d = Math.hypot(x + 0.5 - gridW / 2, y + 0.5 - gridD / 2 - 0.6);
      if (d < best) {
        best = d;
        idle = { pos: [x + 0.5 - gridW / 2, 0, y + 0.5 - gridD / 2], rotY: 0.3, pose: "idle" };
      }
    }

  const act = state.activity ? activityDef(state.activity.defId) : null;
  if (!act) return idle;
  const tag = act.requires ?? (act.id.startsWith("eat_") ? "seat" : null);
  const item = tag ? placed.find((p) => furnitureDef(p.defId)?.enables.includes(tag)) : null;
  if (!item) return { ...idle, pose: "work" };
  const [cx, cz] = cellCentre(item, gridW, gridD);
  const [fx, fz] = front(item.rot);
  const r = deg(item.rot);
  if (tag === "bed" || (tag === "nap" && furnitureDef(item.defId)!.enables.includes("bed"))) {
    return { pos: [cx + Math.sin(r) * 0.85, 0, cz + Math.cos(r) * 0.85], rotY: r, pose: "sleep" };
  }
  if (tag === "seat" || tag === "nap") return { pos: [cx + fx * 0.05, 0, cz + fz * 0.05], rotY: r, pose: tag === "nap" ? "sleep" : "sit" };
  if (tag === "shower" || tag === "toilet") return { pos: [cx, 0, cz], rotY: r, pose: "idle", hidden: true };
  if (tag === "tv") {
    const seat = placed.find((p) => furnitureDef(p.defId)?.enables.includes("seat"));
    if (seat) {
      const [sx, sz] = cellCentre(seat, gridW, gridD);
      return { pos: [sx, 0, sz], rotY: deg(seat.rot), pose: "sit" };
    }
    return { pos: [cx + fx * 1.2, 0, cz + fz * 1.2], rotY: r + Math.PI, pose: "idle" };
  }
  const fp = footprint(item.defId, item.rot);
  const reach = (item.rot % 180 === 0 ? fp.d : fp.w) / 2 + 0.38;
  return { pos: [cx + fx * reach, 0, cz + fz * reach], rotY: r + Math.PI, pose: tag === "books" ? "idle" : "work" };
}

function Room({ gridW, gridD, light, weather }: { gridW: number; gridD: number; light: Lighting; weather: string }) {
  const wall = "#e9dccb";
  const wallH = 2.7;
  const wet = weather === "rain" || weather === "drizzle";
  return (
    <group>
      {/* floorboards */}
      {Array.from({ length: gridW * 2 }, (_, i) => (
        <mesh key={i} position={[-gridW / 2 + 0.25 + i * 0.5, -0.01, 0]} receiveShadow>
          <boxGeometry args={[0.49, 0.02, gridD]} />
          <meshStandardMaterial color={i % 3 === 0 ? "#b08560" : i % 3 === 1 ? "#a77b56" : "#b78c66"} roughness={0.85} />
        </mesh>
      ))}
      {/* back wall with window */}
      <group position={[0, wallH / 2, -gridD / 2 - 0.06]}>
        <mesh receiveShadow>
          <boxGeometry args={[gridW + 0.12, wallH, 0.12]} />
          <meshStandardMaterial color={wall} roughness={0.95} />
        </mesh>
        <mesh position={[0, -wallH / 2 + 0.45, 0.065]}>
          <boxGeometry args={[gridW + 0.12, 0.9, 0.02]} />
          <meshStandardMaterial color="#cdb9a2" roughness={0.9} />
        </mesh>
        <group position={[gridW / 2 - 2.2, 0.35, 0.07]}>
          <mesh>
            <planeGeometry args={[1.3, 1.25]} />
            <meshStandardMaterial color={light.window} emissive={light.window} emissiveIntensity={light.night ? 0.25 : 0.6} />
          </mesh>
          {[-0.33, 0.33].map((x) => (
            <mesh key={x} position={[x, 0, 0.01]}>
              <boxGeometry args={[0.05, 1.25, 0.03]} />
              <meshStandardMaterial color="#f7f3ec" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[1.3, 0.05, 0.03]} />
            <meshStandardMaterial color="#f7f3ec" />
          </mesh>
          <mesh position={[0, -0.68, 0.06]}>
            <boxGeometry args={[1.45, 0.06, 0.16]} />
            <meshStandardMaterial color="#f7f3ec" />
          </mesh>
          {wet &&
            Array.from({ length: 10 }, (_, i) => (
              <mesh key={i} position={[-0.55 + i * 0.12, 0.1 - (i % 3) * 0.25, 0.012]}>
                <planeGeometry args={[0.012, 0.18]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
              </mesh>
            ))}
        </group>
      </group>
      {/* left wall */}
      <group position={[-gridW / 2 - 0.06, wallH / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.12, wallH, gridD + 0.12]} />
          <meshStandardMaterial color="#e3d4c1" roughness={0.95} />
        </mesh>
        <mesh position={[0.065, -wallH / 2 + 0.45, 0]}>
          <boxGeometry args={[0.02, 0.9, gridD + 0.12]} />
          <meshStandardMaterial color="#c8b39b" roughness={0.9} />
        </mesh>
      </group>
      {/* skirting edge at the open sides */}
      <mesh position={[0, -0.06, gridD / 2 + 0.03]}>
        <boxGeometry args={[gridW + 0.12, 0.12, 0.06]} />
        <meshStandardMaterial color="#6e5340" />
      </mesh>
      <mesh position={[gridW / 2 + 0.03, -0.06, 0]}>
        <boxGeometry args={[0.06, 0.12, gridD + 0.12]} />
        <meshStandardMaterial color="#6e5340" />
      </mesh>
      {/* ceiling light pool at night */}
      {light.sunIntensity < 2 && <pointLight position={[0, 2.4, 0]} intensity={light.night ? 2.6 : 1.6} distance={9} color="#ffd9a6" castShadow />}
    </group>
  );
}

function Ghost({ placement, placed, gridW, gridD }: { placement: Placement; placed: Placed[]; gridW: number; gridD: number }) {
  const def = furnitureDef(placement.defId)!;
  const err = placementError({ id: placement.instanceId, defId: placement.defId, x: placement.x, y: placement.y, rot: placement.rot }, placed, gridW, gridD);
  const fp = footprint(placement.defId, placement.rot);
  const [cx, cz] = [placement.x + fp.w / 2 - gridW / 2, placement.y + fp.d / 2 - gridD / 2];
  const tint = err ? "#d4473f" : "#3fae7a";
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fp.w - 0.04, fp.d - 0.04]} />
        <meshBasicMaterial color={tint} transparent opacity={0.45} />
      </mesh>
      <group rotation={[0, deg(placement.rot), 0]}>
        <FurnitureModel defId={def.id} colour={tint} w={def.w} d={def.d} />
      </group>
    </group>
  );
}

export default function HomeScene({ state, light }: { state: State; light: Lighting }) {
  const placement = useGame((s) => s.placement);
  const setPlacement = useGame((s) => s.setPlacement);
  const setSheet = useGame((s) => s.setSheet);
  const { gridW, gridD } = state.home.tier;

  const placed: Placed[] = useMemo(
    () => state.furniture.filter((f) => f.placed).map((f) => ({ id: f.id, defId: f.defId, x: f.x!, y: f.y!, rot: f.rot })),
    [state.furniture],
  );
  const visible = placed.filter((p) => p.id !== placement?.instanceId);
  const spot = avatarSpot(state, visible, gridW, gridD);

  function pointerToCell(px: number, pz: number) {
    if (!placement) return;
    const fp = footprint(placement.defId, placement.rot);
    const x = Math.max(0, Math.min(gridW - fp.w, Math.round(px + gridW / 2 - fp.w / 2)));
    const y = Math.max(0, Math.min(gridD - fp.d, Math.round(pz + gridD / 2 - fp.d / 2)));
    if (x !== placement.x || y !== placement.y) setPlacement({ ...placement, x, y });
  }

  const dist = Math.max(gridW, gridD);
  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.fog, dist * 3, dist * 6]} />
      <hemisphereLight args={["#fff6ea", "#7a6655", light.ambient]} />
      <directionalLight
        position={[dist * 0.6, dist * 1.4, dist * 0.9]}
        intensity={light.sunIntensity}
        color={light.sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-dist}
        shadow-camera-right={dist}
        shadow-camera-top={dist}
        shadow-camera-bottom={-dist}
      />
      <Room gridW={gridW} gridD={gridD} light={light} weather={state.weather.id} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        onPointerMove={(e) => placement && pointerToCell(e.point.x, e.point.z)}
        onClick={(e) => {
          if (placement) {
            e.stopPropagation();
            pointerToCell(e.point.x, e.point.z);
          }
        }}
      >
        <planeGeometry args={[gridW, gridD]} />
        <meshBasicMaterial transparent opacity={placement ? 0.0 : 0} depthWrite={false} />
      </mesh>
      {placement && (
        <gridHelper args={[Math.max(gridW, gridD), Math.max(gridW, gridD), "#17232b", "#17232b"]} position={[0, 0.015, 0]} />
      )}
      {visible.map((p) => {
        const f = state.furniture.find((x) => x.id === p.id)!;
        const def = furnitureDef(p.defId)!;
        const [cx, cz] = cellCentre(p, gridW, gridD);
        return (
          <group
            key={p.id}
            position={[cx, 0, cz]}
            rotation={[0, deg(p.rot), 0]}
            onClick={(e) => {
              if (placement) return;
              e.stopPropagation();
              setSheet("actions");
            }}
          >
            <FurnitureModel defId={def.id} colour={f.colour} w={def.w} d={def.d} />
          </group>
        );
      })}
      {placement && <Ghost placement={placement} placed={visible} gridW={gridW} gridD={gridD} />}
      {!spot.hidden && <Avatar appearance={state.character.appearance} pose={spot.pose} position={spot.pos} rotation={[0, spot.rotY, 0]} />}
      {spot.hidden && state.activity?.defId === "shower" && (
        <mesh position={[spot.pos[0], 1.2, spot.pos[2]]}>
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
      )}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={dist * 1.5} blur={2} far={3} />
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
