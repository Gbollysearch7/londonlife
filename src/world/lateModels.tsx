"use client";
/**
 * Original procedural models for Milestone 5: owned bicycles and cars on the street, prestige furniture
 * at home, and pets that follow, idle and rest near the player. Furniture follows the furniture-kit
 * convention (centred on its footprint, front facing +Z, one cell = 1 unit).
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { isBlocked, toCell, type NavGrid } from "./nav";
import { TextLabel } from "./TextLabel";

function Box({ p, s, c, r = 0.7, m = 0, e }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; e?: string }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={e ? 0.8 : 0} />
    </mesh>
  );
}

function Rod({ a, b, r = 0.025, c }: { a: [number, number, number]; b: [number, number, number]; r?: number; c: string }) {
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  // Cylinders run along Y; tilt them in the Y–Z plane (all bike tubes lie in that plane).
  return (
    <mesh position={mid} rotation={[Math.atan2(dz, dy), 0, -Math.atan2(dx, Math.hypot(dy, dz))]} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={c} roughness={0.4} metalness={0.5} />
    </mesh>
  );
}

function Wheel({ z, r = 0.34 }: { z: number; r?: number }) {
  return (
    <group position={[0, r, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow>
        <torusGeometry args={[r, 0.035, 8, 24]} />
        <meshStandardMaterial color="#17191c" roughness={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
        <meshStandardMaterial color="#a9b0b5" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** A bicycle or electric scooter, authored facing +Z, wheels on the ground. */
export function Bicycle({ colour, scooter = false }: { colour: string; scooter?: boolean }) {
  if (scooter)
    return (
      <group>
        <Wheel z={0.45} r={0.14} />
        <Wheel z={-0.45} r={0.14} />
        <Box p={[0, 0.17, 0]} s={[0.16, 0.05, 0.85]} c={colour} />
        <Rod a={[0, 0.2, 0.42]} b={[0, 1.05, 0.5]} c="#2b2f36" />
        <Rod a={[-0.25, 1.05, 0.5]} b={[0.25, 1.05, 0.5]} c="#2b2f36" r={0.02} />
        <Box p={[0, 0.85, 0.53]} s={[0.08, 0.06, 0.04]} c="#fff1c8" e="#ffe0a0" />
      </group>
    );
  return (
    <group>
      <Wheel z={0.52} />
      <Wheel z={-0.52} />
      <Rod a={[0, 0.34, -0.52]} b={[0, 0.78, -0.12]} c={colour} />
      <Rod a={[0, 0.34, -0.52]} b={[0, 0.4, 0.05]} c={colour} />
      <Rod a={[0, 0.4, 0.05]} b={[0, 0.78, -0.12]} c={colour} />
      <Rod a={[0, 0.78, -0.12]} b={[0, 0.82, 0.42]} c={colour} />
      <Rod a={[0, 0.4, 0.05]} b={[0, 0.82, 0.42]} c={colour} />
      <Rod a={[0, 0.34, 0.52]} b={[0, 0.98, 0.45]} c="#2b2f36" />
      <Rod a={[-0.26, 0.98, 0.45]} b={[0.26, 0.98, 0.45]} c="#2b2f36" r={0.02} />
      <Box p={[0, 0.84, -0.14]} s={[0.12, 0.05, 0.24]} c="#17191c" />
    </group>
  );
}

const CAR_SHAPES: Record<string, { len: number; h: number; cabin: number }> = {
  compact_car: { len: 2.8, h: 0.75, cabin: 1.5 },
  family_car: { len: 3.4, h: 0.85, cabin: 2.0 },
  electric_saloon: { len: 3.6, h: 0.65, cabin: 1.9 },
};

/** The player's own car, authored along +X like the street's cab and bus. */
export function PlayerCar({ groupRef, colour, defId }: { groupRef: React.RefObject<Group | null>; colour: string; defId: string }) {
  const shape = CAR_SHAPES[defId] ?? CAR_SHAPES.compact_car;
  const half = shape.len / 2;
  return (
    <group ref={groupRef}>
      <Box p={[0, 0.3 + shape.h / 2, 0]} s={[shape.len, shape.h, 1.5]} c={colour} r={0.3} m={0.4} />
      <Box p={[-0.15, 0.3 + shape.h + 0.28, 0]} s={[shape.cabin, 0.56, 1.36]} c={colour} r={0.3} m={0.4} />
      {[0.45, -0.75].map((x) => (
        <mesh key={x} position={[x * (shape.cabin / 1.9), 0.3 + shape.h + 0.28, 0.69]}>
          <planeGeometry args={[shape.cabin * 0.4, 0.4]} />
          <meshStandardMaterial color="#9fb3c4" roughness={0.1} metalness={0.5} />
        </mesh>
      ))}
      {[-half + 0.55, half - 0.55].map((x) => (
        <mesh key={x} position={[x, 0.3, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
          <meshStandardMaterial color="#0e0f10" />
        </mesh>
      ))}
      <Box p={[half + 0.01, 0.62, 0]} s={[0.04, 0.16, 1.2]} c="#fff1c8" e="#ffe0a0" />
      <Box p={[-half - 0.01, 0.62, 0]} s={[0.04, 0.12, 1.2]} c="#b52a24" e="#ff3b30" />
    </group>
  );
}

// ───────────────────────────── prestige furniture ─────────────────────────────

export function PrestigeModel({ defId, colour }: { defId: string; colour: string }) {
  switch (defId) {
    case "original_artwork":
      return (
        <group position={[0, 1.55, -0.46]}>
          <Box p={[0, 0, 0]} s={[0.86, 0.66, 0.05]} c="#c69c58" r={0.4} m={0.5} />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.74, 0.54]} />
            <meshStandardMaterial color="#f2ead8" />
          </mesh>
          <mesh position={[-0.12, 0.06, 0.035]}>
            <circleGeometry args={[0.16, 24]} />
            <meshStandardMaterial color={colour} />
          </mesh>
          <mesh position={[0.14, -0.08, 0.036]} rotation={[0, 0, 0.5]}>
            <planeGeometry args={[0.3, 0.12]} />
            <meshStandardMaterial color="#17232b" />
          </mesh>
          <mesh position={[0.12, 0.14, 0.037]}>
            <planeGeometry args={[0.18, 0.06]} />
            <meshStandardMaterial color="#bc3d3b" />
          </mesh>
        </group>
      );
    case "home_cinema":
      return (
        <group>
          <Box p={[0, 0.22, -0.1]} s={[2.8, 0.44, 0.6]} c={colour} r={0.5} />
          <Box p={[0, 1.25, -0.3]} s={[2.5, 1.35, 0.06]} c="#0b0d10" r={0.2} m={0.3} />
          <mesh position={[0, 1.25, -0.265]}>
            <planeGeometry args={[2.38, 1.24]} />
            <meshStandardMaterial color="#27405a" emissive="#4f7fb0" emissiveIntensity={0.35} roughness={0.2} />
          </mesh>
          {[-1.32, 1.32].map((x) => (
            <group key={x} position={[x, 0, 0.05]}>
              <Box p={[0, 0.55, 0]} s={[0.26, 1.1, 0.3]} c="#17191c" />
              <mesh position={[0, 0.75, 0.155]}>
                <circleGeometry args={[0.08, 16]} />
                <meshStandardMaterial color="#3a3a3a" />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "grand_piano":
      return (
        <group>
          <Box p={[0, 0.82, -0.15]} s={[1.5, 0.32, 1.5]} c={colour} r={0.15} m={0.2} />
          <mesh position={[0.25, 1.22, -0.35]} rotation={[0.45, 0, 0]} castShadow>
            <boxGeometry args={[1.3, 0.04, 1.2]} />
            <meshStandardMaterial color={colour} roughness={0.15} metalness={0.2} />
          </mesh>
          <Box p={[0, 0.72, 0.68]} s={[1.3, 0.1, 0.2]} c="#f2f0ea" r={0.3} />
          {Array.from({ length: 9 }, (_, i) => (
            <Box key={i} p={[-0.52 + i * 0.13, 0.78, 0.66]} s={[0.05, 0.04, 0.12]} c="#111111" />
          ))}
          {[[-0.6, -0.75], [0.6, -0.75], [0, 0.5]].map(([x, z]) => (
            <Box key={`${x}${z}`} p={[x, 0.33, z]} s={[0.1, 0.66, 0.1]} c={colour} />
          ))}
          <Box p={[0, 0.25, 0.95]} s={[0.8, 0.08, 0.32]} c="#17191c" />
        </group>
      );
    case "workstation":
      return (
        <group>
          <Box p={[0, 0.72, -0.05]} s={[1.9, 0.05, 0.8]} c={colour} r={0.5} />
          {[-0.85, 0.85].map((x) => (
            <Box key={x} p={[x, 0.36, -0.05]} s={[0.06, 0.72, 0.7]} c="#2b2f36" m={0.6} />
          ))}
          {[-0.55, 0, 0.55].map((x, i) => (
            <group key={x} position={[x, 1.08, -0.3]} rotation={[0, (1 - i) * 0.25, 0]}>
              <Box p={[0, 0, 0]} s={[0.5, 0.32, 0.03]} c="#111418" />
              <mesh position={[0, 0, 0.02]}>
                <planeGeometry args={[0.46, 0.28]} />
                <meshStandardMaterial color="#1d3b2f" emissive="#3fae7a" emissiveIntensity={0.4} />
              </mesh>
            </group>
          ))}
          <Box p={[0.75, 0.95, -0.2]} s={[0.2, 0.42, 0.42]} c="#2b2f36" e="#3fae7a" />
          <Box p={[0, 0.76, 0.12]} s={[0.55, 0.02, 0.16]} c="#3a3a3a" />
        </group>
      );
    default:
      return <Box p={[0, 0.4, 0]} s={[0.9, 0.8, 0.9]} c={colour} />;
  }
}

// ───────────────────────────── pets ─────────────────────────────

export interface PetView {
  id: string;
  kind: "cat" | "dog";
  name: string;
  colour: string;
  needsCare: boolean;
}

function PetBody({ kind, colour, tail, resting }: { kind: "cat" | "dog"; colour: string; tail: React.RefObject<Group | null>; resting: boolean }) {
  const dog = kind === "dog";
  const s = dog ? 1.25 : 1;
  const legH = resting ? 0.02 : 0.14 * s;
  return (
    <group scale={s}>
      <mesh position={[0, legH + 0.1, 0]} scale={[0.6, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.18, 14, 10]} />
        <meshStandardMaterial color={colour} roughness={0.9} />
      </mesh>
      <group position={[0, legH + 0.22, 0.2]}>
        <mesh castShadow scale={dog ? [0.9, 0.85, 1.15] : [1, 0.9, 0.9]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshStandardMaterial color={colour} roughness={0.9} />
        </mesh>
        {dog ? (
          <>
            <Box p={[0, -0.03, 0.09]} s={[0.07, 0.06, 0.08]} c={colour} r={0.9} />
            <Box p={[0, -0.02, 0.135]} s={[0.03, 0.025, 0.02]} c="#17191c" />
            {[-0.08, 0.08].map((x) => (
              <Box key={x} p={[x, 0.0, -0.01]} s={[0.03, 0.11, 0.06]} c={colour} r={0.9} />
            ))}
          </>
        ) : (
          [-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.09, -0.01]} castShadow>
              <coneGeometry args={[0.03, 0.07, 4]} />
              <meshStandardMaterial color={colour} roughness={0.9} />
            </mesh>
          ))
        )}
        {[-0.035, 0.035].map((x) => (
          <mesh key={x} position={[x, 0.025, 0.085]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshStandardMaterial color="#17191c" />
          </mesh>
        ))}
      </group>
      {!resting &&
        [-0.06, 0.06].flatMap((x) =>
          [-0.1, 0.1].map((z) => <Box key={`${x}${z}`} p={[x, legH / 2, z]} s={[0.035, legH, 0.035]} c={colour} r={0.9} />),
        )}
      <group ref={tail} position={[0, legH + 0.14, -0.17]}>
        <mesh position={[0, dog ? 0.04 : 0.09, -0.04]} rotation={[dog ? -0.9 : -0.35, 0, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.02, dog ? 0.14 : 0.22, 6]} />
          <meshStandardMaterial color={colour} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Pet({ pet, index, target, grid, bounds }: { pet: PetView; index: number; target: React.RefObject<Group | null>; grid: NavGrid; bounds: [number, number] }) {
  const root = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const st = useRef({ x: 0.8 + index * 0.5, z: 1.2, rot: 0, still: 0, resting: false });
  // Re-render only when the pet switches between active and resting.
  const [resting, setResting] = useState(false);
  const speed = pet.kind === "dog" ? 1.9 : 1.5;
  useFrame((state, dt) => {
    const s = st.current;
    const g = root.current;
    if (!g) return;
    const p = target.current?.position;
    const step = Math.min(dt, 0.1);
    let moving = false;
    if (p) {
      // Trail a little behind and to one side of the player; each pet keeps its own spot.
      const side = index % 2 ? -1 : 1;
      const dx = p.x + side * 0.65 - s.x;
      const dz = p.z + 0.55 + index * 0.25 - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.45) {
        const nx = s.x + (dx / d) * speed * step;
        const nz = s.z + (dz / d) * speed * step;
        const [i, j] = toCell(grid, nx, nz);
        const inRoom = Math.abs(nx) < bounds[0] / 2 - 0.2 && Math.abs(nz) < bounds[1] / 2 - 0.2;
        if (inRoom && !isBlocked(grid, i, j)) {
          s.x = nx;
          s.z = nz;
          moving = true;
        }
        s.rot = Math.atan2(dx, dz);
      }
    }
    s.still = moving ? 0 : s.still + step;
    // Idle a while, then curl up and rest.
    const nowResting = s.still > 6;
    if (nowResting !== s.resting) {
      s.resting = nowResting;
      setResting(nowResting);
    }
    let r = s.rot - g.rotation.y;
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    g.rotation.y += r * Math.min(1, step * 8);
    const t = state.clock.elapsedTime + index;
    g.position.set(s.x, moving ? Math.abs(Math.sin(t * 12)) * 0.03 : 0, s.z);
    if (tail.current) tail.current.rotation.y = Math.sin(t * (pet.kind === "dog" ? 10 : 2.5)) * (pet.needsCare ? 0.1 : 0.5);
  });
  return (
    <group ref={root} position={[st.current.x, 0, st.current.z]}>
      <PetBody kind={pet.kind} colour={pet.colour} tail={tail} resting={resting} />
      <TextLabel text={pet.name} sub={pet.needsCare ? "· needs care" : resting ? "· resting" : undefined} position={[0, 0.75, 0]} height={0.16} />
    </group>
  );
}

/** The household's pets, following and idling near the player in the home scene. */
export function HomePets({ pets, target, grid, gridW, gridD }: { pets: PetView[]; target: React.RefObject<Group | null>; grid: NavGrid; gridW: number; gridD: number }) {
  return (
    <>
      {pets.map((p, i) => (
        <Pet key={p.id} pet={p} index={i} target={target} grid={grid} bounds={[gridW, gridD]} />
      ))}
    </>
  );
}
