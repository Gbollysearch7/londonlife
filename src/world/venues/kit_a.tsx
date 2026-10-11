"use client";
/** Venues part A props: original procedural models, authored facing +Z and centred on their position. */
import { TextLabel } from "../TextLabel";
import type { PropSpec } from "./props";

const INK = "#17232b";
const IVORY = "#f2f0ea";
const DARKWOOD = "#5a3f2a";
const WOOD = "#b98b5e";
const STEEL = "#a9b0b5";

function B({ p, s, c, r = 0.8, m = 0, e, ei = 0.6, cast = true }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; e?: string; ei?: number; cast?: boolean }) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={e ? ei : 0} />
    </mesh>
  );
}

function Ball({ p, c }: { p: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <sphereGeometry args={[0.045, 12, 10]} />
      <meshStandardMaterial color={c} roughness={0.25} />
    </mesh>
  );
}

/** Small abstract artworks so each frame on a wall reads as a different original piece. */
function Artwork({ v, w, h }: { v: number; w: number; h: number }) {
  switch (v % 5) {
    case 0: // river at dusk
      return (
        <group>
          <B p={[0, h * 0.2, 0]} s={[w, h * 0.6, 0.01]} c="#7a5c8f" cast={false} />
          <B p={[0, -h * 0.25, 0]} s={[w, h * 0.5, 0.01]} c="#2f4a6b" cast={false} />
          <B p={[w * 0.2, h * 0.15, 0.006]} s={[w * 0.18, w * 0.18, 0.01]} c="#ffcf8a" cast={false} />
        </group>
      );
    case 1: // market morning
      return (
        <group>
          <B p={[0, 0, 0]} s={[w, h, 0.01]} c="#f4e3c4" cast={false} />
          {[-0.3, 0, 0.3].map((x, i) => (
            <B key={x} p={[x * w, -h * 0.15, 0.006]} s={[w * 0.25, h * 0.3, 0.01]} c={["#BC3D3B", "#3e7a4f", "#C69C58"][i]} cast={false} />
          ))}
        </group>
      );
    case 2: // estate in bloom
      return (
        <group>
          <B p={[0, 0, 0]} s={[w, h, 0.01]} c="#e9e2d3" cast={false} />
          {[-0.28, 0.05, 0.3].map((x, i) => (
            <B key={x} p={[x * w, -h * 0.1 + i * 0.04, 0.006]} s={[w * 0.18, h * (0.55 + i * 0.1), 0.01]} c={INK} cast={false} />
          ))}
        </group>
      );
    case 3: // heron study
      return (
        <group>
          <B p={[0, 0, 0]} s={[w, h, 0.01]} c="#cfe3ea" cast={false} />
          <B p={[0, 0, 0.006]} s={[w * 0.08, h * 0.6, 0.01]} c="#8c8c84" cast={false} />
        </group>
      );
    default: // arched niche / coloured glass
      return (
        <group>
          <B p={[0, -h * 0.1, 0]} s={[w, h * 0.8, 0.01]} c="#e9d9a8" e="#ffe2a0" ei={0.25} cast={false} />
          <mesh position={[0, h * 0.3, 0.001]}>
            <circleGeometry args={[w / 2, 24, 0, Math.PI]} />
            <meshStandardMaterial color="#e9d9a8" emissive="#ffe2a0" emissiveIntensity={0.25} />
          </mesh>
        </group>
      );
  }
}

const ART_VARIANT: Record<string, number> = { art_river_dusk: 0, art_market_morning: 1, art_estate_bloom: 2 };

/** Original gallery art placed at home (one grid cell). Wall pieces hang like posters; the heron stands on a plinth. */
export function ArtModel({ defId, colour }: { defId: string; colour: string }) {
  if (defId === "art_clay_heron") {
    return (
      <group>
        <B p={[0, 0.4, 0]} s={[0.45, 0.8, 0.45]} c={IVORY} />
        <mesh position={[0, 1.05, 0]} castShadow>
          <sphereGeometry args={[0.16, 14, 10]} />
          <meshStandardMaterial color={colour} roughness={0.35} />
        </mesh>
        <mesh position={[0.04, 1.35, 0.02]} rotation={[0, 0, -0.2]} castShadow>
          <cylinderGeometry args={[0.025, 0.04, 0.4, 8]} />
          <meshStandardMaterial color={colour} roughness={0.35} />
        </mesh>
        <mesh position={[0.1, 1.55, 0.06]} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
          <coneGeometry args={[0.03, 0.2, 8]} />
          <meshStandardMaterial color="#c69c58" />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 1.6, -0.47]}>
      <B p={[0, 0, 0]} s={[0.78, 0.6, 0.04]} c={colour} m={0.3} cast={false} />
      <group position={[0, 0, 0.025]}>
        <Artwork v={ART_VARIANT[defId] ?? 3} w={0.66} h={0.48} />
      </group>
    </group>
  );
}

export function PropA({ s, night }: { s: PropSpec; night: boolean }) {
  const c = s.c;
  switch (s.t) {
    case "pool_table":
      return (
        <group>
          <B p={[0, 0.78, 0]} s={[2.3, 0.08, 1.3]} c={c ?? "#2e7a4f"} r={0.95} />
          {[-1.17, 1.17].map((x) => (
            <B key={x} p={[x, 0.84, 0]} s={[0.1, 0.12, 1.4]} c={DARKWOOD} />
          ))}
          {[-0.67, 0.67].map((z) => (
            <B key={z} p={[0, 0.84, z]} s={[2.44, 0.12, 0.1]} c={DARKWOOD} />
          ))}
          {[-0.95, 0.95].flatMap((x) => [-0.5, 0.5].map((z) => <B key={`${x}${z}`} p={[x, 0.38, z]} s={[0.14, 0.76, 0.14]} c={DARKWOOD} />))}
          <Ball p={[-0.6, 0.865, 0]} c={IVORY} />
          {[0.4, 0.5, 0.5, 0.6, 0.6, 0.6].map((x, i) => (
            <Ball key={i} p={[x, 0.865, [0, -0.05, 0.05, -0.1, 0, 0.1][i]]} c={["#BC3D3B", "#C69C58", INK, "#2F4A6B", "#BC3D3B", "#C69C58"][i]} />
          ))}
          <mesh position={[0.1, 0.9, 0.45]} rotation={[0, 0, Math.PI / 2 - 0.05]}>
            <cylinderGeometry args={[0.012, 0.02, 1.4, 6]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
        </group>
      );
    case "easel":
      return (
        <group>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.8, 0]} rotation={[0.08, 0, x > 0 ? -0.1 : 0.1]} castShadow>
              <boxGeometry args={[0.04, 1.6, 0.04]} />
              <meshStandardMaterial color={WOOD} />
            </mesh>
          ))}
          <mesh position={[0, 0.75, -0.25]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.04, 1.5, 0.04]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
          <B p={[0, 0.7, 0.05]} s={[0.5, 0.04, 0.08]} c={WOOD} />
          <group position={[0, 1.08, 0.04]} rotation={[-0.08, 0, 0]}>
            <B p={[0, 0, 0]} s={[0.56, 0.7, 0.03]} c={IVORY} />
            <group position={[0, 0, 0.02]}>
              <Artwork v={s.v ?? 0} w={0.46} h={0.58} />
            </group>
          </group>
        </group>
      );
    case "art_frame": {
      const w = s.w ?? 1;
      const h = s.h ?? 0.8;
      return (
        <group position={[0, s.y ?? 1.7, 0]}>
          {(s.v ?? 0) !== 4 && <B p={[0, 0, 0]} s={[w + 0.1, h + 0.1, 0.05]} c={c ?? "#C69C58"} m={0.3} cast={false} />}
          <group position={[0, 0, 0.03]}>
            <Artwork v={s.v ?? 0} w={w} h={h} />
          </group>
        </group>
      );
    }
    case "train": {
      const w = s.w ?? 10;
      return (
        <group>
          <B p={[0, 1.45, 0]} s={[w, 2.3, 2.4]} c={c ?? "#e9e6df"} r={0.4} m={0.2} />
          <B p={[0, 0.45, 0]} s={[w, 0.3, 2.2]} c="#2b2f36" />
          <B p={[0, 1.15, 1.205]} s={[w, 0.18, 0.01]} c="#2F4A6B" cast={false} />
          {Array.from({ length: Math.floor(w / 1.6) }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.8 + i * 1.6, 1.85, 1.205]}>
              <planeGeometry args={[1.0, 0.6]} />
              <meshStandardMaterial color="#3a4a5a" emissive="#ffe2a0" emissiveIntensity={night ? 0.6 : 0.05} />
            </mesh>
          ))}
          <B p={[-w / 2 + 0.2, 1.4, 0]} s={[0.4, 2.2, 2.3]} c="#e8c547" />
        </group>
      );
    }
    case "floor_rug":
      return (
        <group>
          <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[s.w ?? 2, s.d ?? 1.4]} />
            <meshStandardMaterial color={c ?? "#5a1e24"} roughness={1} />
          </mesh>
          <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[(s.w ?? 2) - 0.25, (s.d ?? 1.4) - 0.25]} />
            <meshStandardMaterial color="#c69c58" roughness={1} transparent opacity={0.25} />
          </mesh>
        </group>
      );
    case "lectern":
      // v=1 is a donation box on a stand.
      return s.v === 1 ? (
        <group>
          <B p={[0, 0.45, 0]} s={[0.08, 0.9, 0.08]} c={DARKWOOD} />
          <B p={[0, 0.98, 0]} s={[0.4, 0.3, 0.3]} c={c ?? WOOD} />
          <B p={[0, 1.135, 0]} s={[0.2, 0.01, 0.03]} c={INK} cast={false} />
          <TextLabel text="Give if you wish" colour="#f4eee4" background="rgba(23,35,43,0.85)" font="600 48px system-ui, sans-serif" billboard={false} position={[0, 1.35, 0.16]} height={0.12} />
        </group>
      ) : (
        <group>
          <B p={[0, 0.55, 0]} s={[0.45, 1.1, 0.35]} c={c ?? DARKWOOD} />
          <mesh position={[0, 1.15, 0.05]} rotation={[0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.6, 0.05, 0.45]} />
            <meshStandardMaterial color={c ?? DARKWOOD} />
          </mesh>
        </group>
      );
    case "pew": {
      const w = s.w ?? 2.6;
      return (
        <group>
          <B p={[0, 0.44, 0.05]} s={[w, 0.06, 0.42]} c={c ?? DARKWOOD} />
          <B p={[0, 0.78, -0.17]} s={[w, 0.62, 0.06]} c={c ?? DARKWOOD} />
          {[-w / 2 + 0.05, w / 2 - 0.05].map((x) => (
            <B key={x} p={[x, 0.45, 0]} s={[0.08, 0.9, 0.5]} c={DARKWOOD} />
          ))}
          <B p={[0, 0.1, 0.05]} s={[w - 0.2, 0.04, 0.3]} c={STEEL} m={0.3} />
        </group>
      );
    }
    default:
      return null;
  }
}
