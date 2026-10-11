"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, useCursor } from "@react-three/drei";
import { CatmullRomCurve3, Shape, Vector3, type Group, type Mesh } from "three";
import type { State } from "@/client/api";
import { TextLabel } from "./TextLabel";
import type { Lighting } from "./lighting";
import { SceneLights, SkyDome } from "./sceneParts";

/** Compressed city map: map units (≈ km) to world units. x east, y south. */
export const MAP_SCALE = 3;
const W = (m: [number, number]): [number, number, number] => [m[0] * MAP_SCALE, 0, m[1] * MAP_SCALE];

const DISTRICTS: { name: string; at: [number, number]; spread: number; style: "terrace" | "glass" | "warehouse" | "soho" | "market" | "campus"; n: number }[] = [
  { name: "Camden", at: [0.1, 0.0], spread: 1.2, style: "terrace", n: 26 },
  { name: "King's Cross", at: [1.8, 1.0], spread: 0.8, style: "campus", n: 14 },
  { name: "The City", at: [4.4, 3.0], spread: 0.8, style: "glass", n: 16 },
  { name: "Shoreditch", at: [5.2, 2.3], spread: 0.7, style: "warehouse", n: 14 },
  { name: "Soho", at: [2.1, 2.8], spread: 0.6, style: "soho", n: 14 },
  { name: "South Bank", at: [3.3, 4.6], spread: 0.9, style: "market", n: 14 },
  { name: "Brixton", at: [2.8, 8.0], spread: 1.0, style: "terrace", n: 22 },
  { name: "Greenwich", at: [9.5, 6.0], spread: 1.0, style: "glass", n: 16 },
];

// The Thames: a winding spine across the middle of the map.
const RIVER: [number, number][] = [
  [-3, 4.9], [-1, 4.2], [0.8, 4.0], [2.2, 3.8], [3.6, 3.85], [4.8, 3.65], [6.0, 3.9], [6.9, 4.8], [6.4, 5.8], [7.6, 6.5], [9.5, 5.8], [11, 6.2],
];

function rnd(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function River() {
  const geo = useMemo(() => {
    const curve = new CatmullRomCurve3(RIVER.map(([x, y]) => new Vector3(x * MAP_SCALE, 0, y * MAP_SCALE)));
    const pts = curve.getPoints(120);
    // Build a flat ribbon by offsetting each point sideways.
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dir = new Vector3().subVectors(b, a).normalize();
      const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(1.1 + Math.sin(i * 0.2) * 0.15);
      left.push(pts[i].clone().add(side));
      right.push(pts[i].clone().sub(side));
    }
    const shape = new Shape();
    shape.moveTo(left[0].x, -left[0].z);
    for (const p of left) shape.lineTo(p.x, -p.z);
    for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, -right[i].z);
    return shape;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <shapeGeometry args={[geo]} />
      <meshStandardMaterial color="#6f93a3" roughness={0.2} metalness={0.2} />
    </mesh>
  );
}

function Building({ x, z, w, d, h, colour, roof, night, glass }: { x: number; z: number; w: number; d: number; h: number; colour: string; roof: boolean; night: boolean; glass: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={colour} roughness={glass ? 0.25 : 0.85} metalness={glass ? 0.35 : 0} emissive={night ? "#ffb85a" : "#000"} emissiveIntensity={night ? (glass ? 0.12 : 0.05) : 0} />
      </mesh>
      {roof && (
        <mesh position={[0, h + 0.18, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[Math.max(w, d) * 0.72, 0.36, 4]} />
          <meshStandardMaterial color="#4e4a50" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function District({ d, night }: { d: (typeof DISTRICTS)[number]; night: boolean }) {
  const blocks = useMemo(() => {
    const out = [];
    for (let i = 0; i < d.n; i++) {
      const a = rnd(i, d.name.length) * Math.PI * 2;
      const r = Math.sqrt(rnd(i, 3)) * d.spread * MAP_SCALE;
      const x = d.at[0] * MAP_SCALE + Math.cos(a) * r;
      const z = d.at[1] * MAP_SCALE + Math.sin(a) * r;
      const k = rnd(i, 9);
      const style = d.style;
      const h = style === "glass" ? 2 + k * 6 + (i % 5 === 0 ? 4 : 0) : style === "warehouse" ? 0.9 + k * 0.6 : style === "campus" ? 1 + k : 0.7 + k * 0.9;
      const colour =
        style === "glass" ? (k > 0.5 ? "#8fa3b5" : "#a9b7c2") : style === "warehouse" ? (k > 0.5 ? "#7a4a3a" : "#8e5a44") : style === "soho" ? ["#c98a6a", "#e6dcc8", "#a45a45", "#2f4a6b"][i % 4] : style === "market" ? ["#d9cdb8", "#a45a45", "#8e4e3e"][i % 3] : style === "campus" ? ["#e6e2d8", "#c9c4ba", "#a45a45"][i % 3] : ["#8b4b3c", "#9a5a44", "#efe6d6", "#7c4337"][i % 4];
      out.push({ x, z, w: 0.7 + k * 0.6, d: 0.6 + rnd(i, 11) * 0.6, h, colour, roof: style === "terrace" || (style === "soho" && k > 0.5), glass: style === "glass" });
    }
    return out;
  }, [d]);
  return (
    <group>
      {blocks.map((b, i) => (
        <Building key={i} {...b} night={night} />
      ))}
      <TextLabel text={d.name} colour="#17232b" background="rgba(244,238,228,0.75)" font="700 54px Georgia, serif" position={[d.at[0] * MAP_SCALE, 5.5, d.at[1] * MAP_SCALE - 1.6]} height={0.9} />
    </group>
  );
}

function Park({ at, r }: { at: [number, number]; r: number }) {
  return (
    <group position={W(at)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[r, 28]} />
        <meshStandardMaterial color="#7fa863" roughness={1} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = rnd(i, 4) * Math.PI * 2;
        const rr = Math.sqrt(rnd(i, 5)) * r * 0.85;
        return (
          <mesh key={i} position={[Math.cos(a) * rr, 0.6, Math.sin(a) * rr]} castShadow>
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color={i % 2 ? "#4f7a46" : "#5d8650"} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

function Wheel() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.08;
  });
  return (
    <group position={[2.6 * MAP_SCALE, 3.2, 3.95 * MAP_SCALE]}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[2.8, 0.08, 6, 48]} />
          <meshStandardMaterial color="#f2f0ea" metalness={0.4} />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => (
          <group key={i} rotation={[0, 0, (i / 16) * Math.PI * 2]}>
            <mesh position={[0, 1.4, 0]}>
              <boxGeometry args={[0.04, 2.8, 0.04]} />
              <meshStandardMaterial color="#f2f0ea" />
            </mesh>
            <mesh position={[0, 2.8, 0]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color="#cfe3ea" />
            </mesh>
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.9, -1.6, 0]} rotation={[0, 0, s * 0.3]}>
          <boxGeometry args={[0.1, 3.4, 0.1]} />
          <meshStandardMaterial color="#f2f0ea" />
        </mesh>
      ))}
    </group>
  );
}

function ClockTower() {
  return (
    <group position={[1.4 * MAP_SCALE, 0, 4.55 * MAP_SCALE]}>
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[0.7, 5.2, 0.7]} />
        <meshStandardMaterial color="#c9a46a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.4, 0.36]}>
        <circleGeometry args={[0.26, 20]} />
        <meshStandardMaterial color="#fbf8f2" emissive="#ffe6b0" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 5.7, 0]} castShadow>
        <coneGeometry args={[0.55, 1.2, 4]} />
        <meshStandardMaterial color="#3e5a4a" />
      </mesh>
    </group>
  );
}

function Spire() {
  return (
    <mesh position={[3.9 * MAP_SCALE, 5, 4.35 * MAP_SCALE]} castShadow>
      <coneGeometry args={[1.0, 10, 4]} />
      <meshStandardMaterial color="#9fb3c4" roughness={0.15} metalness={0.5} />
    </mesh>
  );
}

function StationShed() {
  return (
    <group position={[1.3 * MAP_SCALE, 0, 0.6 * MAP_SCALE]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 3.6, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#a8b3ba" metalness={0.4} roughness={0.4} side={2} />
      </mesh>
    </group>
  );
}

function Pin({ v, here, selected, onSelect, isHome }: { v: State["directory"][number]; here: boolean; selected: boolean; onSelect: () => void; isHome: boolean }) {
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const ring = useRef<Mesh>(null);
  const grp = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring.current) {
      const k = 1 + ((t * 0.8) % 1) * 1.6;
      ring.current.scale.set(k, k, k);
      (ring.current.material as { opacity: number }).opacity = here ? 0.7 * (1 - ((t * 0.8) % 1)) : 0;
    }
    if (grp.current) grp.current.position.y = (selected || hover ? 0.4 : 0) + Math.sin(t * 2 + v.map[0]) * 0.08;
  });
  const [x, , z] = W(v.map as [number, number]);
  const colour = isHome ? "#c69c58" : !v.open ? "#9a9590" : here ? "#bc3d3b" : "#234c42";
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.45, 0.6, 32]} />
        <meshBasicMaterial color="#bc3d3b" transparent opacity={0} depthWrite={false} />
      </mesh>
      <group
        ref={grp}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
          <meshStandardMaterial color="#17232b" />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow>
          <sphereGeometry args={[selected ? 0.42 : 0.32, 18, 14]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={selected ? 0.4 : 0.15} />
        </mesh>
        {(selected || hover || here || isHome) && (
        <TextLabel
          text={isHome ? "Home" : v.name.replace("Common Table Food Hall", "Food Hall")}
          sub={here ? "· you" : !v.open ? "· closed" : undefined}
          position={[0, 2.95, 0]}
          height={selected || hover ? 0.75 : 0.55}
          background={selected ? "rgba(198,156,88,0.97)" : "rgba(251,248,242,0.94)"}
        />
        )}
      </group>
    </group>
  );
}

function Route({ from, to }: { from: [number, number]; to: [number, number] }) {
  const ref = useRef<Group>(null);
  const pts = useMemo(() => {
    const a = new Vector3(...W(from));
    const b = new Vector3(...W(to));
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.min(6, a.distanceTo(b) * 0.25 + 1);
    return new CatmullRomCurve3([a, mid, b]).getPoints(40);
  }, [from, to]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      const s = 0.12 + 0.06 * Math.sin(t * 4 - i * 0.6);
      c.scale.set(s, s, s);
    });
  });
  return (
    <group ref={ref}>
      {pts.filter((_, i) => i % 2 === 0).map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#bc3d3b" />
        </mesh>
      ))}
    </group>
  );
}

export default function MapScene({ state, light, selected, onSelect }: { state: State; light: Lighting; selected: string | null; onSelect: (id: string) => void }) {
  const here = state.journey ? null : state.character.location;
  const from = state.directory.find((d) => d.id === (state.journey?.destination ?? state.character.location));
  const sel = state.directory.find((d) => d.id === selected);
  return (
    <>
      <SkyDome light={light} />
      <fog attach="fog" args={[light.fog, 40, 110]} />
      <SceneLights light={light} size={30} interior={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7, 0, 12]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#d9d2c0" roughness={1} />
      </mesh>
      <River />
      {DISTRICTS.map((d) => (
        <District key={d.name} d={d} night={light.night} />
      ))}
      <Park at={[-0.9, 0.95]} r={2.6} />
      <Park at={[1.0, 6.4]} r={1.8} />
      <Wheel />
      <ClockTower />
      <Spire />
      <StationShed />
      {[1.4, 3.2, 4.6].map((x, i) => (
        <mesh key={i} position={[x * MAP_SCALE, 0.12, (3.9 + (i === 2 ? -0.1 : 0)) * MAP_SCALE]} rotation={[0, 0.1 * (i - 1), 0]} castShadow>
          <boxGeometry args={[0.5, 0.18, 3.6]} />
          <meshStandardMaterial color="#8a8580" />
        </mesh>
      ))}
      <TextLabel text="River Thames" colour="#2f4a6b" background={null} font="italic 600 60px Georgia, serif" billboard={false} position={[0.6 * MAP_SCALE, 0.06, 4.05 * MAP_SCALE]} rotation={[-Math.PI / 2, 0, 0.1]} height={0.7} />
      {state.directory.map((v) => (
        <Pin key={v.id} v={v} here={here === v.id} selected={selected === v.id} isHome={v.id === "home"} onSelect={() => onSelect(v.id)} />
      ))}
      {from && sel && sel.id !== from.id && <Route from={from.map as [number, number]} to={sel.map as [number, number]} />}
      <OrbitControls target={[6, 0, 11]} enablePan screenSpacePanning={false} minDistance={10} maxDistance={55} minPolarAngle={0.35} maxPolarAngle={1.15} enableDamping />
    </>
  );
}
