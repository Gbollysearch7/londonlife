"use client";
import { useMemo, useRef, useState } from "react";
import { ContactShadows, OrbitControls, useCursor } from "@react-three/drei";
import type { Group } from "three";
import { activityDef, venue } from "@/content/world";
import type { State } from "@/client/api";
import Avatar from "./Avatar";
import { Extra, Walkers } from "./Crowd";
import { CelebrationBurst, FloatingTexts, Particles } from "./effects";
import { useFrame } from "@react-three/fiber";
import { useGame } from "@/client/store";
import { useFx } from "@/client/fx";
import { TextLabel } from "./TextLabel";
import type { Lighting } from "./lighting";
import PlayerAvatar, { type Goal } from "./PlayerAvatar";
import { shiftVisual, visualFor } from "./activityVisuals";
import { standingVariant } from "./poses";
import { HotspotMarker, SceneLights, SkyDome, TapRipple, WalkPlane } from "./sceneParts";
import { useScene } from "./sceneStore";
import { Prop, ShellView } from "./venues/kit";
import { LAYOUTS, type AnchorSpec, type VenueLayout } from "./venues/layouts";
import { buildVenueGrid } from "./venues/props";
import { LiveGameTables } from "./LiveGameTable";
import Billboards from "./Billboards";

const rad = (d: number) => (d * Math.PI) / 180;

export function anchorGoal(key: string, anchor: AnchorSpec, visual: ReturnType<typeof visualFor>): Goal {
  const v = visual.seated && !anchor.seat ? { ...visual, ...standingVariant(visual.pose) } : visual;
  return {
    key,
    pos: anchor.pos,
    y: anchor.y ?? 0,
    rotY: rad(anchor.rotY),
    approach: anchor.approach ?? anchor.pos,
    pose: v.pose,
    prop: v.prop,
    hide: v.hide,
    particles: v.particles,
    roam: v.roam,
  };
}

/** What the player is doing in this venue, as a goal for the avatar (or null when free). */
export function venueGoal(state: State, layout: VenueLayout): Goal | null {
  if (state.shift && layout.workAnchor) {
    const a = layout.anchors[layout.workAnchor];
    if (a) return anchorGoal(`shift:${state.shift.id}`, a, shiftVisual(state.career.current?.careerId));
  }
  if (!state.activity) return null;
  const def = activityDef(state.activity.defId);
  const a = def?.anchor ? layout.anchors[def.anchor] : undefined;
  if (!def || !a) return null;
  return anchorGoal(`act:${state.activity.id}`, a, visualFor(def.id));
}

/** Today's treasure, only rendered when you're standing in the right venue. */
function Gem({ pos }: { pos: [number, number] }) {
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const run = useGame((x) => x.run);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 1.6;
    ref.current.position.y = 1.0 + Math.sin(t * 2.5) * 0.12;
  });
  const claim = async () => {
    const r = await run("ClaimTreasure", {}, "treasure");
    if (r) useFx.getState().push([], [{ title: "Treasure found!", sub: r.message ?? "", icon: "◆" }]);
  };
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <group
        ref={ref}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          void claim();
        }}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
        scale={hover ? 1.25 : 1}
      >
        <mesh castShadow>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#5fb3d9" emissive="#7ad0ff" emissiveIntensity={1.2} metalness={0.4} roughness={0.15} />
        </mesh>
        <pointLight intensity={3} distance={4} color="#9fdcff" />
      </group>
      <Particles kind="sparkle" position={[0, 1.0, 0]} />
    </group>
  );
}

function Npc({ npc, name, onSelect }: { npc: VenueLayout["npcs"][number]; name: string; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  useCursor(hover);
  return (
    <group
      position={[npc.pos[0], 0, npc.pos[1]]}
      rotation={[0, rad(npc.rotY), 0]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <Avatar appearance={npc.appearance} outfit={npc.outfit} pose={npc.pose} prop={npc.prop} mood="happy" phase={npc.pos[0]} />
      <group rotation={[0, -rad(npc.rotY), 0]}>
        <TextLabel text={name} sub="· NPC" position={[0, 2.25, 0]} height={hover ? 0.4 : 0.34} />
      </group>
    </group>
  );
}

export default function VenueScene({ state, light }: { state: State; light: Lighting }) {
  const loc = state.character.location;
  const layout = LAYOUTS[loc] ?? LAYOUTS.food_hall;
  const [w, d] = layout.shell.size;
  const grid = useMemo(
    () => buildVenueGrid(layout.shell.size, layout.props, [...layout.npcs.map((n) => n.pos), ...(layout.extras ?? []).map((e) => e.pos)]),
    [layout],
  );
  const goal = venueGoal(state, layout);
  const player = useRef<Group>(null);
  const walkTo = useScene((s) => s.walkTo);
  const walkTarget = useScene((s) => s.walkTarget);
  const openHotspot = useScene((s) => s.openHotspot);
  const hotspot = useScene((s) => s.hotspot);
  const busy = !!state.activity || !!state.shift;

  // Which anchors have something to do right now (or are special like Leave).
  const anchorActions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const a of state.actions) {
      if (a.npc || a.hidden) continue;
      const anchor = activityDef(a.id)?.anchor;
      if (anchor) (out[anchor] ??= []).push(a.id);
    }
    return out;
  }, [state.actions]);

  const mood = state.mood.score >= 65 ? "happy" : state.mood.score < 40 ? "sad" : "neutral";

  return (
    <>
      <SkyDome light={light} />
      <fog attach="fog" args={[light.fog, 24, 70]} />
      <SceneLights light={light} size={Math.max(w, d)} interior={!layout.shell.outdoor} />
      <ShellView shell={layout.shell} night={light.night} windowColour={light.window} />
      {layout.props.map((p, i) => (
        <Prop key={i} s={p} night={light.night} />
      ))}
      <LiveGameTables props={layout.props} state={state} />
      <Billboards where={loc} state={state} />
      {layout.npcs.map((n) => (
        <Npc
          key={n.id}
          npc={n}
          name={venue(loc)?.npcs.find((x) => x.id === n.id)?.name ?? n.id}
          onSelect={() =>
            openHotspot({
              id: `npc:${n.id}`,
              title: venue(loc)?.npcs.find((x) => x.id === n.id)?.name ?? n.id,
              subtitle: venue(loc)?.npcs.find((x) => x.id === n.id)?.role,
              position: [n.pos[0], 0, n.pos[1]],
              actionIds: state.actions.filter((a) => a.npc === n.id).map((a) => a.id),
            })
          }
        />
      ))}
      {(layout.extras ?? []).map((e) => (
        <Extra key={e.seed} {...e} />
      ))}
      {layout.walkers ? <Walkers grid={grid} count={layout.walkers} seedBase={loc.length * 101} /> : null}
      {Object.entries(layout.anchors).map(([id, a]) => {
        if (!a.label) return null;
        const actionIds = anchorActions[id] ?? [];
        const special = id === "exit" || id === "groceries" || id === "chairs";
        if (!actionIds.length && !special) return null;
        return (
          <HotspotMarker
            key={id}
            pos={a.approach ?? a.pos}
            label={a.label}
            icon={a.icon ?? "◉"}
            active={hotspot?.id === `anchor:${id}`}
            highlight={id === "groceries"}
            onSelect={() => openHotspot({ id: `anchor:${id}`, title: a.label!, position: [a.pos[0], 0, a.pos[1]], actionIds })}
          />
        );
      })}
      {state.treasure.anchor && layout.anchors[state.treasure.anchor] && (
        <Gem pos={(() => {
          const a = layout.anchors[state.treasure.anchor!];
          const p = a.approach ?? a.pos;
          return [p[0] + 0.6, p[1] + 0.4] as [number, number];
        })()} />
      )}
      <WalkPlane size={[w, d]} onWalk={(x, z) => (busy ? openHotspot(null) : walkTo(x, z))} />
      <TapRipple at={busy ? null : walkTarget} />
      <PlayerAvatar
        ref={player}
        appearance={state.character.appearance}
        mood={mood}
        grid={grid}
        goal={goal}
        spawn={layout.spawn}
        sceneKey={loc}
        spawnRotY={rad(90)}
      />
      <FloatingTexts target={player} />
      <CelebrationBurst target={player} />
      <ContactShadows position={[0, 0.006, 0]} opacity={0.32} scale={Math.max(w, d) * 1.4} blur={2.4} far={3} resolution={512} />
      <OrbitControls target={layout.camera.target} enablePan={false} minDistance={7} maxDistance={24} minPolarAngle={0.55} maxPolarAngle={1.2} minAzimuthAngle={-0.6} maxAzimuthAngle={1.0} enableDamping />
    </>
  );
}
