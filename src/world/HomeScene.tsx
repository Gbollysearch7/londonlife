"use client";
import { useMemo, useRef, useState } from "react";
import { ContactShadows, OrbitControls, useCursor } from "@react-three/drei";
import type { Group } from "three";
import { furnitureDef } from "@/content/catalogue";
import type { State } from "@/client/api";
import { useGame, type Placement } from "@/client/store";
import { footprint, placementError, type Placed } from "@/sim/placement";
import { CelebrationBurst, FloatingTexts } from "./effects";
import { FurnitureModel } from "./furnitureModels";
import { cellCentre, furnitureActionIds, homeGrid, homeSpot } from "./homeAnchors";
import type { Lighting } from "./lighting";
import PlayerAvatar, { type Goal } from "./PlayerAvatar";
import { HotspotMarker, SceneLights, SkyDome, TapRipple, WalkPlane } from "./sceneParts";
import { useScene } from "./sceneStore";
import { floorTexture, plasterTexture } from "./textures";
import { TextLabel } from "./TextLabel";
import { HomePets } from "./lateModels";

const deg = (r: number) => (r * Math.PI) / 180;

export { cellCentre };

function Room({ gridW, gridD, light, weather }: { gridW: number; gridD: number; light: Lighting; weather: string }) {
  const wallH = 2.7;
  const wet = weather === "rain" || weather === "drizzle";
  const floor = useMemo(() => {
    const t = floorTexture("wood", "#b08560", "#a77b56").clone();
    t.repeat.set(gridW / 2, gridD / 2);
    t.needsUpdate = true;
    return t;
  }, [gridW, gridD]);
  const backTex = useMemo(() => {
    const t = plasterTexture("#e9dccb", "#cdb9a2").clone();
    t.repeat.set(gridW / 2, 1);
    t.needsUpdate = true;
    return t;
  }, [gridW]);
  const leftTex = useMemo(() => {
    const t = plasterTexture("#e3d4c1", "#c8b39b").clone();
    t.repeat.set(gridD / 2, 1);
    t.needsUpdate = true;
    return t;
  }, [gridD]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[gridW, gridD]} />
        <meshStandardMaterial map={floor} roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[gridW + 0.24, 0.24, gridD + 0.24]} />
        <meshStandardMaterial color="#5a4436" />
      </mesh>
      {/* back wall with window */}
      <group position={[0, wallH / 2, -gridD / 2 - 0.06]}>
        <mesh receiveShadow>
          <boxGeometry args={[gridW + 0.12, wallH, 0.12]} />
          <meshStandardMaterial map={backTex} roughness={0.95} />
        </mesh>
        <group position={[gridW / 2 - 2.2, 0.35, 0.07]}>
          <mesh>
            <planeGeometry args={[1.3, 1.25]} />
            <meshStandardMaterial color={light.window} emissive={light.window} emissiveIntensity={light.night ? 0.25 : 0.7} />
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
          {/* curtains */}
          {[-0.82, 0.82].map((x) => (
            <mesh key={x} position={[x, 0.05, 0.05]} castShadow>
              <boxGeometry args={[0.28, 1.5, 0.05]} />
              <meshStandardMaterial color="#234C42" roughness={1} />
            </mesh>
          ))}
          {wet &&
            Array.from({ length: 10 }, (_, i) => (
              <mesh key={i} position={[-0.55 + i * 0.12, 0.1 - (i % 3) * 0.25, 0.012]}>
                <planeGeometry args={[0.012, 0.18]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
              </mesh>
            ))}
          {!light.night && <pointLight position={[0, 0, 0.8]} intensity={1.2} distance={4} color={light.window} />}
        </group>
      </group>
      {/* left wall with the front door */}
      <group position={[-gridW / 2 - 0.06, wallH / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.12, wallH, gridD + 0.12]} />
          <meshStandardMaterial map={leftTex} roughness={0.95} />
        </mesh>
        <group position={[0.07, -wallH / 2, -0.5]}>
          <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.9, 2.0]} />
            <meshStandardMaterial color="#234C42" />
          </mesh>
          <mesh position={[0.01, 1.0, -0.3]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.035, 10]} />
            <meshStandardMaterial color="#c69c58" metalness={0.8} />
          </mesh>
        </group>
      </group>
      {light.sunIntensity < 2 && <pointLight position={[0, 2.4, 0]} intensity={light.night ? 3.2 : 1.8} distance={10} decay={1.5} color="#ffd9a6" castShadow shadow-mapSize={[512, 512]} />}
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

function FurnitureItem({ p, colour, onSelect, active, inUse }: { p: Placed; colour: string; onSelect: () => void; active: boolean; inUse: boolean }) {
  const def = furnitureDef(p.defId)!;
  const [hover, setHover] = useState(false);
  useCursor(hover && !!def.enables.length);
  return (
    <group
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
      scale={hover || active ? 1.03 : 1}
    >
      <FurnitureModel defId={def.id} colour={colour} w={def.w} d={def.d} />
      {(hover || active) && def.enables.length > 0 && (
        <TextLabel text={def.name} sub={inUse ? "· in use" : undefined} position={[0, 1.9, 0]} height={0.26} />
      )}
    </group>
  );
}

export default function HomeScene({ state, light }: { state: State; light: Lighting }) {
  const placement = useGame((s) => s.placement);
  const setPlacement = useGame((s) => s.setPlacement);
  const setSheet = useGame((s) => s.setSheet);
  const walkTo = useScene((s) => s.walkTo);
  const walkTarget = useScene((s) => s.walkTarget);
  const openHotspot = useScene((s) => s.openHotspot);
  const hotspot = useScene((s) => s.hotspot);
  const { gridW, gridD } = state.home.tier;
  const player = useRef<Group>(null);

  const placed: Placed[] = useMemo(
    () => state.furniture.filter((f) => f.placed).map((f) => ({ id: f.id, defId: f.defId, x: f.x!, y: f.y!, rot: f.rot })),
    [state.furniture],
  );
  const visible = placed.filter((p) => p.id !== placement?.instanceId);
  const grid = useMemo(() => homeGrid(visible, gridW, gridD), [visible.map((p) => `${p.id}${p.x}${p.y}${p.rot}`).join("|"), gridW, gridD]); // eslint-disable-line react-hooks/exhaustive-deps

  const spot = state.activity ? homeSpot(state.activity.defId, visible, gridW, gridD) : null;
  const goal: Goal | null =
    spot && state.activity
      ? {
          key: `act:${state.activity.id}`,
          pos: spot.pos,
          y: 0,
          rotY: spot.rotY,
          approach: spot.approach,
          pose: spot.visual.pose,
          prop: spot.visual.prop,
          hide: spot.visual.hide,
          particles: spot.visual.particles,
        }
      : null;

  function pointerToCell(px: number, pz: number) {
    if (!placement) return;
    const fp = footprint(placement.defId, placement.rot);
    const x = Math.max(0, Math.min(gridW - fp.w, Math.round(px + gridW / 2 - fp.w / 2)));
    const y = Math.max(0, Math.min(gridD - fp.d, Math.round(pz + gridD / 2 - fp.d / 2)));
    if (x !== placement.x || y !== placement.y) setPlacement({ ...placement, x, y });
  }

  const dist = Math.max(gridW, gridD);
  const mood = state.mood.score >= 65 ? "happy" : state.mood.score < 40 ? "sad" : "neutral";
  const door: [number, number] = [-gridW / 2 + 0.45, -0.5];
  return (
    <>
      <SkyDome light={light} />
      <fog attach="fog" args={[light.fog, dist * 3, dist * 7]} />
      <SceneLights light={light} size={dist * 1.4} />
      <Room gridW={gridW} gridD={gridD} light={light} weather={state.weather.id} />
      {placement ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.005, 0]}
          onPointerMove={(e) => pointerToCell(e.point.x, e.point.z)}
          onClick={(e) => {
            e.stopPropagation();
            pointerToCell(e.point.x, e.point.z);
          }}
        >
          <planeGeometry args={[gridW, gridD]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : (
        <WalkPlane size={[gridW, gridD]} onWalk={(x, z) => (state.activity ? openHotspot(null) : walkTo(x, z))} />
      )}
      {placement && <gridHelper args={[Math.max(gridW, gridD), Math.max(gridW, gridD), "#17232b", "#17232b"]} position={[0, 0.015, 0]} />}
      {visible.map((p) => {
        const f = state.furniture.find((x) => x.id === p.id)!;
        const def = furnitureDef(p.defId)!;
        const [cx, cz] = cellCentre(p, gridW, gridD);
        return (
          <group key={p.id} position={[cx, 0, cz]} rotation={[0, deg(p.rot), 0]}>
            <FurnitureItem
              p={p}
              colour={f.colour}
              active={hotspot?.id === p.id}
              inUse={spot?.furnitureId === p.id}
              onSelect={() => {
                if (placement) return;
                openHotspot({ id: p.id, title: def.name, subtitle: def.blurb, position: [cx, 0, cz], actionIds: furnitureActionIds(def.id, state.actions), furnitureId: p.id });
              }}
            />
          </group>
        );
      })}
      {placement && <Ghost placement={placement} placed={visible} gridW={gridW} gridD={gridD} />}
      {!placement && (
        <HotspotMarker pos={door} label="Head out" icon="⌖" active={false} onSelect={() => setSheet("map")} />
      )}
      <TapRipple at={state.activity ? null : walkTarget} />
      <PlayerAvatar ref={player} appearance={state.character.appearance} mood={mood} grid={grid} goal={goal} spawn={[0, 0.6]} sceneKey="home" spawnRotY={0.3} />
      <HomePets pets={state.pets.list} target={player} grid={grid} gridW={gridW} gridD={gridD} />
      <FloatingTexts target={player} />
      <CelebrationBurst target={player} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={dist * 1.5} blur={2} far={3} resolution={512} />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        enableRotate={!placement}
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
