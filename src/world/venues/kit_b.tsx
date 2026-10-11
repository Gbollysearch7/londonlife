"use client";
/**
 * Procedural renderers for the venue part B props (see props_b.ts). Same conventions as kit.tsx:
 * authored facing +Z at rotation 0, centred on the prop position; the parent applies position/rotation.
 */
import { TextLabel } from "../TextLabel";
import type { PropSpec } from "./props";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const INK = "#17232b";
const IVORY = "#f2f0ea";
const WOOD = "#b98b5e";

function B({ p, s, c, r = 0.8, m = 0, e, ei = 0.8, cast = true }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number; e?: string; ei?: number; cast?: boolean }) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={e ? ei : 0} />
    </mesh>
  );
}

function Cyl({ p, a, c, r = 0.7, m = 0, rot }: { p: [number, number, number]; a: [number, number, number, number?]; c: string; r?: number; m?: number; rot?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 16]} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} />
    </mesh>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <mesh position={[x, 0.36, 0]} castShadow>
      <torusGeometry args={[0.33, 0.035, 8, 24]} />
      <meshStandardMaterial color={INK} roughness={0.6} />
    </mesh>
  );
}

export function PropB({ s, night }: { s: PropSpec; night: boolean }) {
  const c = s.c;
  switch (s.t) {
    case "stands": {
      const w = s.w ?? 8;
      const rows = Math.round(s.d ?? 3);
      return (
        <group>
          {range(rows).map((r) => (
            <group key={r} position={[0, 0, (rows - 1) / 2 - r]}>
              <B p={[0, 0.15 + r * 0.3, 0]} s={[w, 0.3 + r * 0.6, 1]} c="#9a958c" r={0.95} />
              {range(Math.round(w / 0.55)).map((i) => (
                <group key={i} position={[-w / 2 + 0.275 + i * 0.55, 0.3 + r * 0.6, 0.15]}>
                  <B p={[0, 0.12, 0]} s={[0.42, 0.06, 0.38]} c={c ?? "#BC3D3B"} r={0.5} />
                  <B p={[0, 0.32, -0.17]} s={[0.42, 0.36, 0.05]} c={c ?? "#BC3D3B"} r={0.5} />
                </group>
              ))}
            </group>
          ))}
        </group>
      );
    }
    case "goal": {
      const w = s.w ?? 3;
      return (
        <group>
          {[-w / 2, w / 2].map((x) => (
            <Cyl key={x} p={[x, 0.7, 0]} a={[0.05, 0.05, 1.4, 8]} c={IVORY} />
          ))}
          <Cyl p={[0, 1.4, 0]} a={[0.05, 0.05, w, 8]} c={IVORY} rot={[0, 0, Math.PI / 2]} />
          <mesh position={[0, 0.7, -0.5]} rotation={[0.35, 0, 0]}>
            <planeGeometry args={[w, 1.5]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.25} side={2} />
          </mesh>
        </group>
      );
    }
    case "pool": {
      const w = s.w ?? 6;
      const d = s.d ?? 3;
      return (
        <group>
          <B p={[0, 0.06, 0]} s={[w + 0.4, 0.12, d + 0.4]} c="#e9eef0" r={0.4} cast={false} />
          <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={c ?? "#4fa3c4"} roughness={0.08} metalness={0.2} emissive="#2a7fa0" emissiveIntensity={night ? 0.5 : 0.15} />
          </mesh>
          {range(Math.max(1, Math.round(d / 1) - 1)).map((i, _k, a) => (
            <mesh key={i} position={[0, 0.14, -d / 2 + ((i + 1) * d) / (a.length + 1)]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, w, 6]} />
              <meshStandardMaterial color={i % 2 ? "#BC3D3B" : IVORY} />
            </mesh>
          ))}
          {[-0.3, 0.3].map((x) => (
            <Cyl key={x} p={[w / 2 - 0.4 + x, 0.55, d / 2 + 0.05]} a={[0.025, 0.025, 0.8, 6]} c="#c9cfd3" m={0.8} />
          ))}
        </group>
      );
    }
    case "massage_table":
      return (
        <group>
          {[-0.8, 0.8].flatMap((z) => [-0.3, 0.3].map((x) => <B key={`${x}${z}`} p={[x, 0.35, z]} s={[0.06, 0.7, 0.06]} c={WOOD} />))}
          <B p={[0, 0.75, 0]} s={[0.75, 0.12, 1.95]} c={c ?? "#e9e2d3"} r={0.9} />
          <B p={[0, 0.83, 0.3]} s={[0.78, 0.04, 0.9]} c="#f4eee4" r={1} />
          <B p={[0, 0.84, -0.8]} s={[0.4, 0.06, 0.25]} c="#c9b79a" r={1} />
        </group>
      );
    case "hotel_bed":
      return (
        <group>
          <B p={[0, 0.25, 0]} s={[1.7, 0.5, 2.1]} c={WOOD} />
          <B p={[0, 0.58, 0.05]} s={[1.62, 0.18, 2.0]} c="#f4f1ea" r={1} />
          <B p={[0, 0.69, 0.45]} s={[1.66, 0.06, 1.2]} c={c ?? "#2F4A6B"} r={1} />
          {[-0.4, 0.4].map((x) => (
            <B key={x} p={[x, 0.75, -0.75]} s={[0.6, 0.14, 0.35]} c={IVORY} r={1} />
          ))}
          <B p={[0, 0.9, -1.03]} s={[1.8, 1.1, 0.08]} c="#5a3f2a" />
        </group>
      );
    case "boat": {
      const w = s.w ?? 8;
      return (
        <group>
          <B p={[0, 0.25, 0]} s={[w, 0.9, 2.4]} c={c ?? "#2F4A6B"} r={0.5} />
          <B p={[0, 0.72, 0]} s={[w - 0.1, 0.06, 2.3]} c="#c9a878" r={0.7} />
          <mesh position={[w / 2 + 0.55, 0.25, 0]} rotation={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[1.2, 1.2, 0.9, 3, 1, false, -Math.PI / 6, Math.PI / 3]} />
            <meshStandardMaterial color={c ?? "#2F4A6B"} roughness={0.5} />
          </mesh>
          <B p={[-0.6, 1.35, 0]} s={[w * 0.5, 1.2, 1.8]} c={IVORY} r={0.6} />
          {range(5).map((i) => (
            <B key={i} p={[-0.6 - w * 0.2 + i * (w * 0.1), 1.45, 0.91]} s={[0.5, 0.45, 0.02]} c="#9fc3d6" e={night ? "#ffd890" : undefined} ei={0.7} cast={false} />
          ))}
          <B p={[-0.6, 2.0, 0]} s={[w * 0.52, 0.08, 1.9]} c={INK} />
          <B p={[w * 0.3, 1.0, 1.15]} s={[w * 0.35, 0.04, 0.04]} c="#c9cfd3" m={0.7} />
          {s.text && <TextLabel text={s.text} colour={IVORY} background={null} font="700 52px Georgia, serif" billboard={false} position={[w * 0.25, 0.4, 1.21]} height={0.3} />}
        </group>
      );
    }
    case "golf_flag":
      return (
        <group>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[s.w ?? 1.6, 32]} />
            <meshStandardMaterial color="#5fa054" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color={INK} />
          </mesh>
          <Cyl p={[0, 1.0, 0]} a={[0.02, 0.02, 2.0, 6]} c={IVORY} />
          <B p={[0.25, 1.8, 0]} s={[0.5, 0.32, 0.02]} c={c ?? "#BC3D3B"} cast={false} />
        </group>
      );
    case "bike":
      return (
        <group>
          <Wheel x={-0.55} />
          <Wheel x={0.55} />
          <B p={[0, 0.6, 0]} s={[1.0, 0.05, 0.05]} c={c ?? "#BC3D3B"} m={0.4} />
          <B p={[-0.25, 0.48, 0]} s={[0.05, 0.4, 0.05]} c={c ?? "#BC3D3B"} m={0.4} />
          <B p={[-0.25, 0.75, 0]} s={[0.25, 0.05, 0.12]} c={INK} />
          <B p={[0.5, 0.85, 0]} s={[0.05, 0.05, 0.45]} c={INK} />
          <B p={[0.48, 0.7, 0]} s={[0.05, 0.3, 0.05]} c={c ?? "#BC3D3B"} m={0.4} />
        </group>
      );
    case "lumber": {
      const w = s.w ?? 2.2;
      return (
        <group>
          {range(4).map((layer) =>
            range(4).map((i) => (
              <B key={`${layer}${i}`} p={[0, 0.1 + layer * 0.16, -0.36 + i * 0.24]} s={[w, 0.14, 0.2]} c={(layer + i) % 2 ? "#c9a06a" : c ?? "#b8885a"} r={0.95} />
            )),
          )}
          {[-w / 2 + 0.2, w / 2 - 0.2].map((x) => (
            <B key={x} p={[x, 0.03, 0]} s={[0.15, 0.06, 1.0]} c="#5a3f2a" />
          ))}
        </group>
      );
    }
    case "plane": {
      const k = s.h ?? 1;
      return (
        <group scale={k}>
          <Cyl p={[0, 2.2, 0]} a={[1.1, 1.1, 18, 20]} c={c ?? "#f2f4f6"} r={0.4} m={0.2} rot={[0, 0, Math.PI / 2]} />
          <mesh position={[9.6, 2.2, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <coneGeometry args={[1.1, 2.4, 20]} />
            <meshStandardMaterial color={c ?? "#f2f4f6"} roughness={0.4} />
          </mesh>
          <B p={[0, 1.9, 0]} s={[3, 0.2, 16]} c="#d9dde1" r={0.5} />
          <B p={[-8.4, 4.0, 0]} s={[2, 3.4, 0.25]} c="#2F4A6B" />
          <B p={[-8.4, 2.6, 0]} s={[1.6, 0.18, 5.5]} c="#d9dde1" />
          {[-4, 4].map((z) => (
            <Cyl key={z} p={[0.6, 1.2, z]} a={[0.55, 0.55, 2.2, 14]} c="#9aa2a8" m={0.5} rot={[0, 0, Math.PI / 2]} />
          ))}
          {range(14).map((i) => (
            <B key={i} p={[-6 + i * 0.95, 2.6, 1.06]} s={[0.3, 0.3, 0.05]} c="#2b3640" e={night ? "#ffd890" : undefined} ei={0.6} cast={false} />
          ))}
          <B p={[0, 0.6, 0]} s={[0.3, 1.2, 0.3]} c={INK} />
        </group>
      );
    }
    case "ballot_booth":
      return (
        <group>
          <B p={[0, 1.0, -0.42]} s={[0.85, 2.0, 0.05]} c={c ?? "#2F4A6B"} />
          {[-0.42, 0.42].map((x) => (
            <B key={x} p={[x, 1.0, 0]} s={[0.05, 2.0, 0.85]} c={c ?? "#2F4A6B"} />
          ))}
          <B p={[0, 1.0, -0.25]} s={[0.75, 0.04, 0.3]} c={IVORY} />
          <mesh position={[0.15, 1.15, 0.43]}>
            <planeGeometry args={[0.5, 1.3]} />
            <meshStandardMaterial color="#C69C58" side={2} roughness={1} />
          </mesh>
        </group>
      );
    case "lectern":
      return (
        <group>
          <B p={[0, 0.55, 0]} s={[0.5, 1.1, 0.4]} c={c ?? "#5a3f2a"} />
          <mesh position={[0, 1.15, 0.02]} rotation={[-0.4, 0, 0]} castShadow>
            <boxGeometry args={[0.6, 0.05, 0.45]} />
            <meshStandardMaterial color={c ?? "#5a3f2a"} />
          </mesh>
          <Cyl p={[0.18, 1.3, 0.05]} a={[0.01, 0.01, 0.3, 6]} c={INK} rot={[0.5, 0, 0]} />
        </group>
      );
    case "van": {
      const w = s.w ?? 3.6;
      return (
        <group>
          <B p={[-0.3, 1.05, 0]} s={[w * 0.72, 1.7, 1.7]} c={c ?? "#e9e2d3"} r={0.5} />
          <B p={[w * 0.36, 0.8, 0]} s={[w * 0.28, 1.2, 1.7]} c={c ?? "#e9e2d3"} r={0.5} />
          <B p={[w * 0.45, 1.15, 0]} s={[0.05, 0.5, 1.5]} c="#9fc3d6" cast={false} />
          {[-w * 0.3, w * 0.3].flatMap((x) => [-0.86, 0.86].map((z) => <Cyl key={`${x}${z}`} p={[x, 0.32, z]} a={[0.32, 0.32, 0.2, 14]} c={INK} rot={[Math.PI / 2, 0, 0]} />))}
          <TextLabel text="Build Yard" colour="#f4eee4" background="rgba(35,76,66,0.95)" font="700 52px system-ui, sans-serif" billboard={false} position={[-0.3, 1.2, 0.86]} height={0.3} />
        </group>
      );
    }
    default:
      return null;
  }
}
