"use client";
/**
 * Original procedural venue kit. Every prop is authored facing +Z at rotation 0 and centred on its position.
 * `propBlock` returns the walk-blocking footprint so navigation always matches what is drawn.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { TextLabel } from "../TextLabel";
import { brickTexture, floorTexture, panelTexture, plasterTexture } from "../textures";
import type { PropSpec, Shell, WallSpec } from "./props";

export type { PropSpec, PropType, Shell, WallSpec } from "./props";

const deg = (d = 0) => (d * Math.PI) / 180;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

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

const WOOD = "#b98b5e";
const DARKWOOD = "#5a3f2a";
const STEEL = "#a9b0b5";
const INK = "#17232b";
const IVORY = "#f2f0ea";

function Pendant({ y = 2.7, on, c = "#234C42" }: { y?: number; on: boolean; c?: string }) {
  return (
    <group position={[0, y, 0]}>
      <B p={[0, 0.5, 0]} s={[0.02, 1, 0.02]} c={INK} cast={false} />
      <mesh>
        <coneGeometry args={[0.22, 0.22, 18, 1, true]} />
        <meshStandardMaterial color={c} side={2} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#fff2cf" emissive="#ffd890" emissiveIntensity={on ? 2 : 0.4} />
      </mesh>
      {on && <pointLight position={[0, -0.25, 0]} intensity={2.2} distance={6} decay={1.6} color="#ffd9a0" />}
    </group>
  );
}

function Tree({ s = 1, v = 0 }: { s?: number; v?: number }) {
  const greens = ["#4f7a46", "#5d8650", "#3f6b3c", "#6a8f4f"];
  return (
    <group scale={s}>
      <Cyl p={[0, 1.1, 0]} a={[0.11, 0.16, 2.2, 8]} c="#4a3a2c" r={0.95} />
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[Math.sin(k * 2.1 + v) * 0.35, 2.6 + k * 0.35, Math.cos(k * 2.1 + v) * 0.3]} castShadow>
          <icosahedronGeometry args={[0.95 - k * 0.18, 1]} />
          <meshStandardMaterial color={greens[(k + v) % greens.length]} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Stool({ c = DARKWOOD }: { c?: string }) {
  return (
    <group>
      <Cyl p={[0, 0.72, 0]} a={[0.18, 0.18, 0.06, 14]} c={c} />
      <Cyl p={[0, 0.36, 0]} a={[0.03, 0.04, 0.72, 6]} c={INK} m={0.5} />
      <Cyl p={[0, 0.02, 0]} a={[0.16, 0.16, 0.03, 12]} c={INK} m={0.5} />
    </group>
  );
}

function Chair({ c = DARKWOOD }: { c?: string }) {
  return (
    <group>
      <B p={[0, 0.45, 0]} s={[0.45, 0.05, 0.45]} c={c} />
      <B p={[0, 0.72, -0.2]} s={[0.45, 0.5, 0.05]} c={c} />
      {[-0.19, 0.19].flatMap((x) => [-0.19, 0.19].map((z) => <B key={`${x}${z}`} p={[x, 0.22, z]} s={[0.04, 0.44, 0.04]} c={INK} />))}
    </group>
  );
}

function DanceFloor({ w = 4, d = 3 }: { w?: number; d?: number }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const cols = Math.round(w);
  const rows = Math.round(d);
  const palette = ["#bc3d3b", "#c69c58", "#2f4a6b", "#7a3f8f", "#2f8a5f"];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const on = Math.sin(t * 3 + (i % cols) * 1.3 + Math.floor(i / cols) * 0.7) > 0.3;
      const mat = m.material as unknown as { emissiveIntensity: number };
      mat.emissiveIntensity = on ? 1.1 : 0.12;
    });
  });
  return (
    <group>
      {Array.from({ length: cols * rows }, (_, i) => {
        const x = (i % cols) - (cols - 1) / 2;
        const z = Math.floor(i / cols) - (rows - 1) / 2;
        const col = palette[(i * 7) % palette.length];
        return (
          <mesh key={i} ref={(m) => void (refs.current[i] = m)} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[0.96, 0.96]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function River({ w = 20, d = 4 }: { w?: number; d?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as unknown as { emissiveIntensity: number }).emissiveIntensity = 0.12 + Math.sin(clock.getElapsedTime() * 0.8) * 0.04;
  });
  return (
    <group>
      <mesh ref={ref} position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d, 1, 1]} />
        <meshStandardMaterial color="#4f6f7d" roughness={0.15} metalness={0.3} emissive="#6f93a3" emissiveIntensity={0.12} />
      </mesh>
      <B p={[0, -0.1, -d / 2]} s={[w, 0.3, 0.2]} c="#9aa0a3" />
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / 6), -0.22, (i % 2 ? 0.6 : -0.4)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.4, 0.05]} />
          <meshBasicMaterial color="#c8dbe3" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Skyline({ w = 30, night }: { w?: number; night: boolean }) {
  const blocks = useMemo(
    () =>
      Array.from({ length: Math.round(w / 1.6) }, (_, i) => {
        const r = Math.sin(i * 12.9898) * 43758.5453;
        const f = r - Math.floor(r);
        return { x: -w / 2 + i * 1.6 + f * 0.4, h: 3 + f * 9 + (i % 7 === 3 ? 8 : 0), w: 1.2 + f * 0.8, glass: i % 4 === 1 };
      }),
    [w],
  );
  return (
    <group>
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, 0]}>
          <mesh>
            <boxGeometry args={[b.w, b.h, 1]} />
            <meshStandardMaterial color={b.glass ? "#8fa3b5" : "#a7a29a"} roughness={b.glass ? 0.2 : 0.9} metalness={b.glass ? 0.4 : 0} />
          </mesh>
          {night &&
            Array.from({ length: Math.floor(b.h / 1.2) }, (_, k) => (
              <mesh key={k} position={[((k * 37) % 3) * 0.25 - 0.25, -b.h / 2 + 0.8 + k * 1.1, 0.51]}>
                <planeGeometry args={[0.25, 0.3]} />
                <meshBasicMaterial color="#ffd58a" />
              </mesh>
            ))}
        </group>
      ))}
    </group>
  );
}

/** Renders a single prop. `night` switches lights and emissive signs. */
export function Prop({ s, night }: { s: PropSpec; night: boolean }) {
  const c = s.c;
  let body: React.ReactNode = null;
  switch (s.t) {
    case "counter": {
      const w = s.w ?? 3;
      const d = s.d ?? 0.8;
      body = (
        <group>
          <B p={[0, 0.5, 0]} s={[w, 1, d]} c={c ?? "#234C42"} />
          <B p={[0, 1.03, 0]} s={[w + 0.08, 0.06, d + 0.1]} c="#d9d4c8" r={0.35} />
          <B p={[0, 0.06, d / 2 + 0.01]} s={[w, 0.12, 0.02]} c={INK} />
          {range(Math.max(1, Math.round(w / 1.2))).map((i, _k, a) => (
            <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / a.length), 0.55, d / 2 + 0.012]}>
              <planeGeometry args={[w / a.length - 0.14, 0.66]} />
              <meshStandardMaterial color="#000000" transparent opacity={0.12} />
            </mesh>
          ))}
        </group>
      );
      break;
    }
    case "kitchen_back": {
      const w = s.w ?? 3;
      body = (
        <group>
          <B p={[0, 0.5, 0]} s={[w, 1, 0.55]} c="#3a3a3a" />
          <B p={[0, 1.02, 0]} s={[w, 0.04, 0.6]} c={STEEL} m={0.6} r={0.3} />
          {range(Math.max(2, Math.round(w / 1.4))).map((i, _k, arr) => (
            <Cyl key={i} p={[-w / 2 + (i + 0.5) * (w / arr.length), 1.2, 0]} a={[0.18, 0.18, 0.3, 16]} c={i % 2 ? STEEL : "#46505b"} m={0.7} r={0.35} />
          ))}
          <B p={[0, 2.0, -0.15]} s={[w, 0.06, 0.4]} c={STEEL} m={0.6} />
        </group>
      );
      break;
    }
    case "sign":
      body = (
        <group position={[0, s.y ?? 2.6, 0]}>
          <B p={[0, 0, -0.03]} s={[s.w ?? 3.2, s.h ?? 0.8, 0.04]} c={c ?? INK} e={night ? c ?? INK : undefined} ei={0.2} cast={false} />
          <TextLabel text={s.text ?? ""} colour="#f4eee4" background={null} font="700 72px Georgia, serif" billboard={false} position={[0, 0, 0.01]} height={(s.h ?? 0.8) * 0.5} />
        </group>
      );
      break;
    case "neon":
      body = <TextLabel text={s.text ?? ""} colour={c ?? "#ff6fae"} background={null} font="italic 700 80px Georgia, serif" billboard={false} position={[0, s.y ?? 2.4, 0]} height={s.h ?? 0.5} />;
      break;
    case "long_table": {
      const d = s.d ?? 2.6;
      body = (
        <group>
          <B p={[0, 0.74, 0]} s={[1.1, 0.06, d]} c={c ?? WOOD} />
          {[-d / 2 + 0.2, d / 2 - 0.2].map((z) => (
            <B key={z} p={[0, 0.37, z]} s={[0.9, 0.74, 0.08]} c={DARKWOOD} />
          ))}
          {[-0.85, 0.85].map((bx) => (
            <B key={bx} p={[bx, 0.42, 0]} s={[0.35, 0.06, d - 0.2]} c="#7a5134" />
          ))}
          <Cyl p={[0.2, 0.8, -d / 5]} a={[0.16, 0.12, 0.05, 16]} c={IVORY} />
          <Cyl p={[-0.25, 0.8, d / 4]} a={[0.05, 0.04, 0.12, 10]} c="#c06a4a" />
        </group>
      );
      break;
    }
    case "round_table":
      body = (
        <group>
          <Cyl p={[0, 0.72, 0]} a={[0.7, 0.7, 0.06, 28]} c={c ?? WOOD} />
          <Cyl p={[0, 0.36, 0]} a={[0.08, 0.12, 0.72, 8]} c={DARKWOOD} />
          {[0, 1, 2].map((k) => (
            <group key={k} position={[Math.sin((k * Math.PI * 2) / 3) * 0.95, 0, Math.cos((k * Math.PI * 2) / 3) * 0.95]} scale={0.8}>
              <Stool />
            </group>
          ))}
          <B p={[0, 0.77, 0]} s={[0.5, 0.03, 0.5]} c={IVORY} />
        </group>
      );
      break;
    case "cafe_table":
      body = (
        <group>
          <Cyl p={[0, 0.72, 0]} a={[0.4, 0.4, 0.04, 20]} c={c ?? IVORY} />
          <Cyl p={[0, 0.36, 0]} a={[0.04, 0.04, 0.72, 8]} c={INK} m={0.5} />
          <group position={[0, 0, 0.55]} rotation={[0, Math.PI, 0]}>
            <Chair c={c === IVORY ? DARKWOOD : "#46505b"} />
          </group>
          <group position={[0, 0, -0.55]}>
            <Chair c={c === IVORY ? DARKWOOD : "#46505b"} />
          </group>
          <Cyl p={[0.1, 0.78, 0]} a={[0.04, 0.035, 0.09, 10]} c="#fbf8f2" />
        </group>
      );
      break;
    case "shelf": {
      const w = s.w ?? 2.6;
      const goods = ["#BC3D3B", "#C69C58", "#3e7a4f", "#e9e2d3", "#d58a3a", "#2F4A6B"];
      body = (
        <group>
          <B p={[0, 1, -0.1]} s={[w, 2, 0.4]} c={c ?? "#7a5134"} />
          {[0.45, 1.05, 1.65].map((y, r) =>
            Array.from({ length: Math.round(w / 0.5) }, (_, i) => (
              <B key={`${r}${i}`} p={[-w / 2 + 0.25 + i * 0.5, y, 0.08]} s={[0.36, 0.26 - (i % 3) * 0.04, 0.3]} c={goods[(i + r * 2) % goods.length]} />
            )),
          )}
        </group>
      );
      break;
    }
    case "pendant":
      body = <Pendant y={s.y} on={night} c={c} />;
      break;
    case "plant":
    case "planter":
      body = (
        <group scale={s.h ?? 1}>
          <Cyl p={[0, 0.25, 0]} a={[0.25, 0.2, 0.5, 14]} c={s.t === "planter" ? "#46505b" : "#c06a4a"} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.16, 0.75 + (i % 3) * 0.16, Math.sin(a) * 0.16]} castShadow>
                <sphereGeometry args={[0.22, 8, 6]} />
                <meshStandardMaterial color={i % 2 ? "#3e7a4f" : "#2f6340"} roughness={0.9} />
              </mesh>
            );
          })}
        </group>
      );
      break;
    case "noticeboard": {
      const w = s.w ?? 2.4;
      body = (
        <group position={[0, s.y ?? 1.6, 0]}>
          <B p={[0, 0, 0]} s={[w, 1.4, 0.06]} c="#b88a5c" cast={false} />
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.3 + (i % 4) * ((w - 0.6) / 3), 0.35 - Math.floor(i / 4) * 0.42, 0.04]} rotation={[0, 0, ((i * 37) % 11) / 60 - 0.08]}>
              <planeGeometry args={[0.42, 0.32]} />
              <meshStandardMaterial color={["#fbf8f2", "#f1e3c4", "#dcebe3", "#f5dcd8"][i % 4]} />
            </mesh>
          ))}
        </group>
      );
      break;
    }
    case "bunting": {
      const w = s.w ?? 9;
      const n = Math.round(w / 0.8);
      body = (
        <group position={[0, s.y ?? 3, 0]}>
          {Array.from({ length: n }, (_, i) => (
            <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / n), -Math.sin((i / (n - 1)) * Math.PI) * 0.25, 0]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.16, 0.3, 3]} />
              <meshStandardMaterial color={["#BC3D3B", "#C69C58", "#234C42", "#2F4A6B"][i % 4]} />
            </mesh>
          ))}
        </group>
      );
      break;
    }
    case "hatch": {
      const w = s.w ?? 3;
      body = (
        <group>
          <B p={[0, 0.5, 0]} s={[w, 1, 0.7]} c={c ?? "#2F4A6B"} />
          <B p={[0, 1.03, 0]} s={[w + 0.1, 0.06, 0.8]} c="#e2ddd2" r={0.4} />
          <Cyl p={[0.6, 1.2, 0]} a={[0.25, 0.25, 0.3, 18]} c={STEEL} m={0.7} r={0.35} />
          <Cyl p={[-0.5, 1.15, 0.1]} a={[0.18, 0.15, 0.2, 14]} c="#c06a4a" />
        </group>
      );
      break;
    }
    case "old_sofa":
    case "sofa": {
      const w = s.w ?? 2.2;
      const col = c ?? (s.t === "old_sofa" ? "#7a6a5a" : "#234C42");
      body = (
        <group>
          <B p={[0, 0.25, 0.05]} s={[w, 0.3, 0.85]} c={col} r={0.95} />
          <B p={[0, 0.62, -0.32]} s={[w, 0.55, 0.22]} c={col} r={0.95} />
          {[-1, 1].map((sx) => (
            <B key={sx} p={[sx * (w / 2 - 0.09), 0.42, 0.05]} s={[0.18, 0.35, 0.85]} c={col} r={0.95} />
          ))}
          {range(Math.max(1, Math.round(w / 0.8))).map((i, _k, a) => (
            <B key={i} p={[-w / 2 + 0.2 + (i + 0.5) * ((w - 0.4) / a.length), 0.44, 0.08]} s={(w - 0.4) / a.length - 0.04 > 0 ? [(w - 0.4) / a.length - 0.04, 0.1, 0.68] : [0.5, 0.1, 0.68]} c={col} r={1} />
          ))}
        </group>
      );
      break;
    }
    case "computer_desk": {
      const w = s.w ?? 2.6;
      body = (
        <group>
          <B p={[0, 0.74, 0]} s={[w, 0.06, 0.9]} c={c ?? "#d9c3a0"} />
          {[-w / 2 + 0.05, w / 2 - 0.05].map((x) => (
            <B key={x} p={[x, 0.37, 0]} s={[0.05, 0.74, 0.8]} c="#7a5134" />
          ))}
          {[-w / 4, w / 4].map((x) => (
            <group key={x}>
              <B p={[x, 1.05, -0.2]} s={[0.55, 0.36, 0.04]} c={INK} r={0.3} />
              <mesh position={[x, 1.05, -0.177]}>
                <planeGeometry args={[0.5, 0.3]} />
                <meshStandardMaterial color="#2b4f66" emissive="#3a6a8a" emissiveIntensity={0.6} />
              </mesh>
              <B p={[x, 0.79, 0.05]} s={[0.4, 0.02, 0.14]} c="#2b2f36" />
              <group position={[x, 0, 0.62]} rotation={[0, Math.PI, 0]}>
                <Chair c="#2F4A6B" />
              </group>
            </group>
          ))}
        </group>
      );
      break;
    }
    case "office_desk":
      body = (
        <group>
          <B p={[0, 0.74, 0]} s={[1.6, 0.05, 0.8]} c={c ?? "#e9e4da"} r={0.5} />
          {[-0.72, 0.72].map((x) => (
            <B key={x} p={[x, 0.37, 0]} s={[0.05, 0.74, 0.7]} c="#46505b" />
          ))}
          <B p={[0, 1.02, -0.25]} s={[0.6, 0.36, 0.04]} c={INK} r={0.3} />
          <mesh position={[0, 1.02, -0.227]}>
            <planeGeometry args={[0.54, 0.3]} />
            <meshStandardMaterial color="#2b4f66" emissive="#3a6a8a" emissiveIntensity={0.55} />
          </mesh>
          <B p={[0, 0.8, -0.25]} s={[0.06, 0.12, 0.06]} c="#46505b" />
          <group position={[0, 0, 0.62]} rotation={[0, Math.PI, 0]}>
            <Chair c="#234C42" />
          </group>
        </group>
      );
      break;
    case "reception": {
      const w = s.w ?? 1.9;
      body = (
        <group>
          <B p={[0, 0.55, 0]} s={[w, 1.1, 0.7]} c={c ?? "#2F4A6B"} />
          <B p={[0, 1.13, 0]} s={[w + 0.1, 0.06, 0.8]} c="#e9e4da" r={0.4} />
          <B p={[0.4, 1.3, -0.15]} s={[0.4, 0.28, 0.03]} c={INK} />
        </group>
      );
      break;
    }
    case "glass_pod":
      body = (
        <group>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[2, 2.4, 2]} />
            <meshStandardMaterial color="#cfe3ea" transparent opacity={0.22} roughness={0.05} />
          </mesh>
          <B p={[0, 0.72, 0]} s={[1.1, 0.05, 0.7]} c={WOOD} />
          <B p={[0, 2.42, 0]} s={[2.04, 0.06, 2.04]} c="#2b2f36" />
        </group>
      );
      break;
    case "break_kitchen": {
      const w = s.w ?? 2.3;
      body = (
        <group>
          <B p={[0, 0.5, 0]} s={[w, 1, 0.7]} c={c ?? IVORY} />
          <B p={[0, 1.03, 0]} s={[w + 0.1, 0.06, 0.8]} c="#3a3a3a" r={0.4} />
          <B p={[w / 2 - 0.5, 1.25, -0.1]} s={[0.3, 0.4, 0.3]} c="#1a1a1a" />
          <Cyl p={[-w / 2 + 0.4, 1.12, 0]} a={[0.05, 0.04, 0.12, 10]} c="#fbf8f2" />
        </group>
      );
      break;
    }
    case "door":
    case "wc_door":
      body = (
        <group>
          <B p={[0, 1.05, 0]} s={[1.0, 2.1, 0.06]} c={c ?? (s.t === "wc_door" ? "#2F4A6B" : "#234C42")} cast={false} />
          <B p={[0, 2.15, 0.01]} s={[1.15, 0.1, 0.08]} c={IVORY} cast={false} />
          <Cyl p={[0.35, 1.0, 0.05]} a={[0.035, 0.035, 0.06, 10]} c="#c69c58" m={0.8} rot={[Math.PI / 2, 0, 0]} />
          <TextLabel text={s.text ?? (s.t === "wc_door" ? "WC" : "Exit")} colour="#f4eee4" background={s.t === "wc_door" ? "rgba(23,35,43,0.9)" : "rgba(35,76,66,0.95)"} font="700 56px system-ui, sans-serif" billboard={false} position={[0, 2.45, 0.05]} height={0.22} />
        </group>
      );
      break;
    case "stage": {
      const w = s.w ?? 4;
      const d = s.d ?? 2;
      const h = s.h ?? 0.35;
      body = (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={c ?? "#2b2622"} />
          <B p={[0, h + 0.005, 0]} s={[w - 0.1, 0.01, d - 0.1]} c="#3a302a" r={0.5} cast={false} />
          <B p={[0, 2.2, -d / 2 + 0.05]} s={[w, 3.2, 0.06]} c="#5a1e24" r={1} cast={false} />
          {[-w / 2 + 0.6, 0, w / 2 - 0.6].map((x) => (
            <group key={x} position={[x, 3.4, d / 2 - 0.3]}>
              <Cyl p={[0, 0, 0]} a={[0.1, 0.14, 0.25, 10]} c={INK} rot={[0.6, 0, 0]} />
              {night && <spotLight position={[0, 0, 0]} target-position={[x, 0, 0]} angle={0.5} penumbra={0.6} intensity={8} distance={7} color={x === 0 ? "#ffd9a0" : x < 0 ? "#ff9ad5" : "#9ad5ff"} />}
            </group>
          ))}
        </group>
      );
      break;
    }
    case "bar": {
      const w = s.w ?? 4;
      body = (
        <group>
          <B p={[0, 0.55, 0]} s={[w, 1.1, 0.7]} c={c ?? "#5a3322"} />
          <B p={[0, 1.13, 0.02]} s={[w + 0.1, 0.07, 0.85]} c="#2b1d14" r={0.3} />
          <B p={[0, 0.12, 0.37]} s={[w, 0.05, 0.05]} c="#c69c58" m={0.8} r={0.3} />
          {range(Math.round(w / 0.9)).map((i, _k, a) => (
            <group key={i} position={[-w / 2 + (i + 0.5) * (w / a.length), 0, 0.75]}>
              <Stool c="#5a1e24" />
            </group>
          ))}
          {/* back bar shelves with bottles */}
          <group position={[0, 0, -1.05]}>
            <B p={[0, 1.4, 0]} s={[w, 2.2, 0.3]} c="#3a2418" />
            {[1.0, 1.55, 2.1].map((y, r) =>
              Array.from({ length: Math.round(w / 0.25) }, (_, i) => (
                <Cyl key={`${r}${i}`} p={[-w / 2 + 0.15 + i * 0.25, y, 0.12]} a={[0.04, 0.05, 0.28, 8]} c={["#3e7a4f", "#c69c58", "#9a3a2a", "#cfe3ea", "#4a2a1a"][(i + r) % 5]} r={0.2} m={0.1} />
              )),
            )}
          </group>
          {[-w / 3, 0, w / 3].map((x) => (
            <Cyl key={x} p={[x, 1.32, 0.05]} a={[0.03, 0.03, 0.3, 8]} c="#c69c58" m={0.8} />
          ))}
        </group>
      );
      break;
    }
    case "stool":
      body = <Stool c={c} />;
      break;
    case "speaker":
      body = (
        <group>
          <B p={[0, 0.7, 0]} s={[0.55, 1.4, 0.5]} c="#1a1a1a" r={0.5} />
          {[0.95, 0.45].map((y, i) => (
            <Cyl key={y} p={[0, y, 0.26]} a={[i ? 0.17 : 0.1, i ? 0.17 : 0.1, 0.02, 18]} c="#2b2f36" rot={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      );
      break;
    case "dj_booth":
      body = (
        <group>
          <B p={[0, 0.55, 0]} s={[1.7, 1.1, 0.8]} c="#17232b" />
          <B p={[0, 1.12, 0]} s={[1.75, 0.04, 0.85]} c="#2b2f36" />
          {[-0.45, 0.45].map((x) => (
            <Cyl key={x} p={[x, 1.16, 0]} a={[0.2, 0.2, 0.03, 20]} c="#46505b" m={0.6} />
          ))}
          <B p={[0, 0.55, 0.405]} s={[1.5, 0.5, 0.01]} c="#7a3f8f" e="#c06fe0" ei={night ? 0.8 : 0.3} />
        </group>
      );
      break;
    case "dance_floor":
      body = <DanceFloor w={s.w} d={s.d} />;
      break;
    case "treadmill":
      body = (
        <group>
          <B p={[0, 0.15, 0.1]} s={[0.75, 0.2, 1.7]} c="#2b2f36" />
          <B p={[0, 0.26, 0.1]} s={[0.6, 0.02, 1.5]} c="#17232b" r={0.9} />
          {[-0.34, 0.34].map((x) => (
            <B key={x} p={[x, 0.75, -0.65]} s={[0.05, 1.1, 0.05]} c={STEEL} m={0.6} />
          ))}
          <B p={[0, 1.3, -0.65]} s={[0.75, 0.25, 0.1]} c="#2b2f36" />
          <mesh position={[0, 1.3, -0.59]}>
            <planeGeometry args={[0.4, 0.15]} />
            <meshStandardMaterial color="#1f3b4d" emissive="#2f8a5f" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
      break;
    case "weight_bench":
      body = (
        <group>
          <B p={[0, 0.45, 0.2]} s={[0.35, 0.08, 1.2]} c={c ?? "#BC3D3B"} r={0.6} />
          <B p={[0, 0.22, 0.2]} s={[0.08, 0.44, 0.9]} c="#2b2f36" m={0.5} />
          {[-0.45, 0.45].map((x) => (
            <B key={x} p={[x, 0.65, -0.5]} s={[0.06, 1.3, 0.06]} c={STEEL} m={0.6} />
          ))}
          <Cyl p={[0, 1.15, -0.5]} a={[0.02, 0.02, 1.6, 8]} c={STEEL} m={0.8} rot={[0, 0, Math.PI / 2]} />
          {[-0.7, 0.7].map((x) => (
            <Cyl key={x} p={[x, 1.15, -0.5]} a={[0.2, 0.2, 0.06, 16]} c="#2b2f36" rot={[0, 0, Math.PI / 2]} />
          ))}
        </group>
      );
      break;
    case "rack": {
      const w = s.w ?? 1.8;
      body = (
        <group>
          <B p={[0, 0.3, 0]} s={[w, 0.05, 0.5]} c="#2b2f36" m={0.5} />
          <B p={[0, 0.6, -0.1]} s={[w, 0.05, 0.3]} c="#2b2f36" m={0.5} />
          {Array.from({ length: Math.round(w / 0.3) }, (_, i) => (
            <group key={i} position={[-w / 2 + 0.15 + i * 0.3, 0.38, 0.05]} rotation={[0, Math.PI / 2, 0]}>
              {[-0.1, 0.1].map((z) => (
                <Cyl key={z} p={[0, 0, z]} a={[0.05 + (i % 3) * 0.01, 0.05 + (i % 3) * 0.01, 0.06, 12]} c="#46505b" m={0.6} rot={[Math.PI / 2, 0, 0]} />
              ))}
            </group>
          ))}
        </group>
      );
      break;
    }
    case "yoga_mat":
      body = <B p={[0, 0.01, 0]} s={[0.7, 0.02, 1.8]} c={c ?? "#2f8a5f"} r={0.9} cast={false} />;
      break;
    case "mirror":
      body = (
        <group position={[0, s.y ?? 1.4, 0]}>
          <B p={[0, 0, 0]} s={[(s.w ?? 1.2) + 0.1, (s.h ?? 1.6) + 0.1, 0.04]} c="#c69c58" m={0.6} cast={false} />
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[s.w ?? 1.2, s.h ?? 1.6]} />
            <meshStandardMaterial color="#cfe3ea" metalness={0.9} roughness={0.05} />
          </mesh>
        </group>
      );
      break;
    case "bookcase": {
      const w = s.w ?? 2;
      const cols = ["#234C42", "#BC3D3B", "#C69C58", "#2F4A6B", "#7a6a5a", "#e9e2d3"];
      body = (
        <group>
          <B p={[0, 1.2, -0.05]} s={[w, 2.4, 0.4]} c={c ?? "#5a3f2a"} />
          {[0.3, 0.85, 1.4, 1.95].map((y, row) =>
            Array.from({ length: Math.round(w / 0.11) - 1 }, (_, i) => (
              <B key={`${row}${i}`} p={[-w / 2 + 0.12 + i * 0.11, y + 0.16, 0.1]} s={[0.085, 0.32 - ((i + row) % 3) * 0.05, 0.26]} c={cols[(i * 3 + row * 2) % cols.length]} />
            )),
          )}
        </group>
      );
      break;
    }
    case "reading_table": {
      const w = s.w ?? 2;
      body = (
        <group>
          <B p={[0, 0.74, 0]} s={[w, 0.06, 0.9]} c={c ?? "#7a5134"} />
          {[-w / 2 + 0.1, w / 2 - 0.1].map((x) => (
            <B key={x} p={[x, 0.37, 0]} s={[0.08, 0.74, 0.8]} c={DARKWOOD} />
          ))}
          {[-w / 4, w / 4].map((x) => (
            <group key={x}>
              <group position={[x, 0, 0.62]} rotation={[0, Math.PI, 0]}>
                <Chair />
              </group>
              <Cyl p={[x + 0.3, 0.95, -0.25]} a={[0.02, 0.02, 0.4, 6]} c="#c69c58" m={0.7} />
              <mesh position={[x + 0.3, 1.15, -0.2]}>
                <coneGeometry args={[0.12, 0.12, 14, 1, true]} />
                <meshStandardMaterial color="#234C42" side={2} emissive="#ffd890" emissiveIntensity={night ? 0.5 : 0.1} />
              </mesh>
            </group>
          ))}
        </group>
      );
      break;
    }
    case "armchair":
      body = (
        <group>
          <B p={[0, 0.25, 0.03]} s={[0.85, 0.3, 0.8]} c={c ?? "#BC3D3B"} r={0.95} />
          <B p={[0, 0.65, -0.32]} s={[0.85, 0.6, 0.18]} c={c ?? "#BC3D3B"} r={0.95} />
          {[-0.38, 0.38].map((x) => (
            <B key={x} p={[x, 0.45, 0.03]} s={[0.12, 0.35, 0.8]} c={c ?? "#BC3D3B"} r={0.95} />
          ))}
        </group>
      );
      break;
    case "lamp_post":
      body = (
        <group>
          <Cyl p={[0, 1.9, 0]} a={[0.05, 0.08, 3.8, 8]} c={INK} m={0.4} />
          <B p={[0, 3.85, 0]} s={[0.3, 0.32, 0.3]} c="#fff1c8" e="#ffcf7a" ei={night ? 1.6 : 0.1} />
          <B p={[0, 4.05, 0]} s={[0.4, 0.06, 0.4]} c={INK} />
          {night && <pointLight position={[0, 3.6, 0]} intensity={5} distance={9} decay={1.5} color="#ffcf8a" />}
        </group>
      );
      break;
    case "tree":
      body = <Tree s={s.h} v={s.v} />;
      break;
    case "bench":
      body = (
        <group>
          {[0, 1, 2].map((k) => (
            <B key={k} p={[0, 0.45, -0.15 + k * 0.15]} s={[1.6, 0.05, 0.12]} c={c ?? "#7a5134"} />
          ))}
          {[0, 1].map((k) => (
            <B key={k} p={[0, 0.7 + k * 0.17, -0.28]} s={[1.6, 0.1, 0.04]} c={c ?? "#7a5134"} />
          ))}
          {[-0.7, 0.7].map((x) => (
            <B key={x} p={[x, 0.3, 0]} s={[0.06, 0.6, 0.55]} c={INK} m={0.4} />
          ))}
        </group>
      );
      break;
    case "hedge": {
      const w = s.w ?? 3;
      body = (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[w, 1, 0.65]} />
            <meshStandardMaterial color="#3f6b3c" roughness={1} />
          </mesh>
          {Array.from({ length: Math.round(w / 0.5) }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.25 + i * 0.5, 1.0, 0]} castShadow>
              <icosahedronGeometry args={[0.32, 0]} />
              <meshStandardMaterial color={i % 2 ? "#4f7a46" : "#3f6b3c"} flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      );
      break;
    }
    case "pond": {
      const w = s.w ?? 4;
      const d = s.d ?? 3;
      body = (
        <group>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w / 2, d / 2, 1]}>
            <circleGeometry args={[1, 32]} />
            <meshStandardMaterial color="#5b7f86" roughness={0.1} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w / 2, d / 2, 1]}>
            <ringGeometry args={[0.95, 1.08, 32]} />
            <meshStandardMaterial color="#a8a196" roughness={0.9} />
          </mesh>
          {[0.3, -0.5].map((x, i) => (
            <group key={i} position={[x * w * 0.3, 0.05, (i ? 0.2 : -0.25) * d]}>
              <mesh>
                <sphereGeometry args={[0.1, 10, 8]} />
                <meshStandardMaterial color={i ? "#f4eee4" : "#3e5a3a"} />
              </mesh>
              <mesh position={[0.09, 0.08, 0]}>
                <sphereGeometry args={[0.05, 8, 6]} />
                <meshStandardMaterial color={i ? "#f4eee4" : "#2f5a3a"} />
              </mesh>
            </group>
          ))}
        </group>
      );
      break;
    }
    case "pavilion": {
      const w = s.w ?? 4;
      const d = s.d ?? 3;
      body = (
        <group>
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[sx * (w / 2 - 0.15), 1.3, sz * (d / 2 - 0.15)]} a={[0.08, 0.08, 2.6, 10]} c={IVORY} />))}
          <mesh position={[0, 3.0, 0]} castShadow>
            <coneGeometry args={[Math.max(w, d) * 0.75, 1.1, 4]} />
            <meshStandardMaterial color="#234C42" roughness={0.8} />
          </mesh>
          <B p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#d9d2c4" cast={false} />
        </group>
      );
      break;
    }
    case "stall": {
      const w = s.w ?? 2.4;
      const col = c ?? "#BC3D3B";
      const goods = ["#d58a3a", "#3e7a4f", "#BC3D3B", "#e9e2d3", "#C69C58", "#7a3f8f"];
      body = (
        <group>
          <B p={[0, 0.45, 0]} s={[w, 0.9, 0.9]} c={WOOD} />
          {Array.from({ length: Math.round(w / 0.35) }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.2 + i * 0.35, 0.98, 0.1 + (i % 2) * 0.15]} castShadow>
              {s.v === 1 ? <boxGeometry args={[0.28, 0.12, 0.2]} /> : <sphereGeometry args={[0.12, 10, 8]} />}
              <meshStandardMaterial color={goods[(i + (s.v ?? 0)) % goods.length]} roughness={0.8} />
            </mesh>
          ))}
          {[-w / 2 + 0.05, w / 2 - 0.05].map((x) => (
            <Cyl key={x} p={[x, 1.3, -0.4]} a={[0.03, 0.03, 2.6, 6]} c={INK} />
          ))}
          {Array.from({ length: Math.round(w / 0.4) }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.2 + i * 0.4, 2.45, 0]} rotation={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[0.4, 0.03, 1.3]} />
              <meshStandardMaterial color={i % 2 ? col : IVORY} roughness={0.9} />
            </mesh>
          ))}
          {s.text && <TextLabel text={s.text} colour={col} background="rgba(251,248,242,0.95)" font="700 52px Georgia, serif" billboard={false} position={[0, 2.0, 0.48]} height={0.2} />}
        </group>
      );
      break;
    }
    case "river":
      body = <River w={s.w} d={s.d} />;
      break;
    case "railing": {
      const w = s.w ?? 4;
      body = (
        <group>
          <B p={[0, 1.0, 0]} s={[w, 0.06, 0.06]} c={INK} m={0.5} />
          <B p={[0, 0.5, 0]} s={[w, 0.04, 0.04]} c={INK} m={0.5} />
          {Array.from({ length: Math.round(w / 0.5) + 1 }, (_, i) => (
            <B key={i} p={[-w / 2 + i * (w / Math.round(w / 0.5)), 0.5, 0]} s={[0.04, 1.0, 0.04]} c={INK} m={0.5} />
          ))}
        </group>
      );
      break;
    }
    case "salon_chair":
      body = (
        <group>
          <Cyl p={[0, 0.06, 0]} a={[0.3, 0.3, 0.08, 18]} c={STEEL} m={0.7} />
          <Cyl p={[0, 0.3, 0]} a={[0.06, 0.06, 0.45, 8]} c={STEEL} m={0.7} />
          <B p={[0, 0.55, 0.02]} s={[0.6, 0.12, 0.55]} c={c ?? "#7a3f8f"} r={0.5} />
          <B p={[0, 0.95, -0.24]} s={[0.55, 0.7, 0.1]} c={c ?? "#7a3f8f"} r={0.5} />
          {[-0.3, 0.3].map((x) => (
            <B key={x} p={[x, 0.75, 0.02]} s={[0.07, 0.05, 0.5]} c={STEEL} m={0.6} />
          ))}
        </group>
      );
      break;
    case "basin":
      body = (
        <group>
          <B p={[0, 0.45, 0]} s={[0.7, 0.9, 0.6]} c={IVORY} />
          <Cyl p={[0, 0.92, 0.05]} a={[0.25, 0.2, 0.08, 18]} c="#e9eef0" r={0.2} />
          <B p={[0, 1.15, -0.2]} s={[0.05, 0.4, 0.05]} c={STEEL} m={0.8} />
        </group>
      );
      break;
    case "whiteboard":
      body = (
        <group position={[0, s.y ?? 1.6, 0]}>
          <B p={[0, 0, 0]} s={[(s.w ?? 2.6) + 0.08, 1.3, 0.05]} c="#c9ced2" m={0.5} cast={false} />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[s.w ?? 2.6, 1.22]} />
            <meshStandardMaterial color="#fbfdfd" roughness={0.3} />
          </mesh>
          {s.text && <TextLabel text={s.text} colour="#2F4A6B" background={null} font="600 56px system-ui, sans-serif" billboard={false} position={[0, 0.25, 0.04]} height={0.22} />}
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[-0.6 + k * 0.4, -0.2 - k * 0.05, 0.035]}>
              <planeGeometry args={[0.35 + k * 0.2, 0.03]} />
              <meshBasicMaterial color={k === 1 ? "#BC3D3B" : "#46505b"} />
            </mesh>
          ))}
        </group>
      );
      break;
    case "lecture_seats": {
      const w = s.w ?? 5;
      const rows = Math.round(s.d ?? 3);
      body = (
        <group>
          {Array.from({ length: rows }, (_, r) => (
            <group key={r} position={[0, r * 0.2, -r * 1 + (rows - 1) / 2]}>
              <B p={[0, 0.1, 0]} s={[w, 0.2, 1]} c="#9a8a7a" cast={false} />
              <B p={[0, 0.85, -0.05]} s={[w - 0.2, 0.05, 0.35]} c={WOOD} />
              {Array.from({ length: Math.round(w / 0.7) }, (_, i) => (
                <group key={i} position={[-w / 2 + 0.35 + i * 0.7, 0.2, 0.3]} scale={0.9}>
                  <Chair c="#2F4A6B" />
                </group>
              ))}
            </group>
          ))}
        </group>
      );
      break;
    }
    case "screen":
      body = (
        <group position={[0, s.y ?? 2, 0]}>
          <B p={[0, 0, 0]} s={[(s.w ?? 3) + 0.1, (s.h ?? 1.7) + 0.1, 0.06]} c={INK} cast={false} />
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[s.w ?? 3, s.h ?? 1.7]} />
            <meshStandardMaterial color={c ?? "#2f6355"} emissive={c ?? "#2f8a5f"} emissiveIntensity={0.55} />
          </mesh>
          {s.text && <TextLabel text={s.text} colour="#f4eee4" background={null} font="700 56px system-ui, sans-serif" billboard={false} position={[0, 0, 0.04]} height={0.24} />}
        </group>
      );
      break;
    case "dartboard":
      body = (
        <group position={[0, s.y ?? 1.7, 0]}>
          {[0.25, 0.18, 0.1, 0.03].map((r, i) => (
            <mesh key={r} position={[0, 0, 0.01 + i * 0.005]}>
              <circleGeometry args={[r, 24]} />
              <meshStandardMaterial color={["#17232b", "#f2e3c4", "#BC3D3B", "#234C42"][i]} />
            </mesh>
          ))}
        </group>
      );
      break;
    case "busk_pitch":
      body = (
        <group>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.9, 28]} />
            <meshStandardMaterial color="#c69c58" transparent opacity={0.35} />
          </mesh>
          <group position={[0.6, 0, 0.4]}>
            <B p={[0, 0.12, 0]} s={[0.5, 0.24, 0.3]} c="#3a2a1e" />
            <B p={[0, 0.25, 0]} s={[0.44, 0.02, 0.26]} c="#5a1e24" />
          </group>
        </group>
      );
      break;
    case "crate":
      body = (
        <group>
          <B p={[0, 0.25, 0]} s={[0.55, 0.5, 0.55]} c={c ?? "#b98b5e"} />
          {[0.12, 0.38].map((y) => (
            <B key={y} p={[0, y, 0.28]} s={[0.56, 0.04, 0.01]} c={DARKWOOD} />
          ))}
        </group>
      );
      break;
    case "piano":
      body = (
        <group>
          <B p={[0, 0.65, 0]} s={[1.5, 1.3, 0.6]} c={c ?? "#17232b"} r={0.3} />
          <B p={[0, 0.78, 0.38]} s={[1.4, 0.06, 0.2]} c={IVORY} />
          {Array.from({ length: 10 }, (_, i) => (
            <B key={i} p={[-0.6 + i * 0.135, 0.82, 0.36]} s={[0.05, 0.04, 0.12]} c={INK} />
          ))}
          <B p={[0, 0.25, 0.75]} s={[0.8, 0.05, 0.35]} c={INK} />
        </group>
      );
      break;
    case "drum_kit":
      body = (
        <group>
          <Cyl p={[0, 0.35, 0]} a={[0.3, 0.3, 0.45, 18]} c="#BC3D3B" rot={[Math.PI / 2, 0, 0]} />
          {[-0.4, 0.4].map((x) => (
            <Cyl key={x} p={[x, 0.6, 0.1]} a={[0.18, 0.18, 0.2, 14]} c="#BC3D3B" />
          ))}
          {[-0.6, 0.6].map((x) => (
            <group key={x}>
              <Cyl p={[x, 0.55, -0.2]} a={[0.015, 0.015, 1.1, 6]} c={STEEL} m={0.8} />
              <Cyl p={[x, 1.1, -0.2]} a={[0.25, 0.25, 0.01, 18]} c="#c69c58" m={0.9} r={0.2} />
            </group>
          ))}
        </group>
      );
      break;
    case "mic_stand":
      body = (
        <group>
          <Cyl p={[0, 0.02, 0]} a={[0.15, 0.15, 0.03, 14]} c={INK} />
          <Cyl p={[0, 0.75, 0]} a={[0.012, 0.012, 1.5, 6]} c={STEEL} m={0.8} />
          <mesh position={[0, 1.52, 0.05]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color="#a9b0b5" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
      break;
    case "skyline":
      body = <Skyline w={s.w} night={night} />;
      break;
    case "picnic_blanket":
      body = (
        <group>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 1.3]} />
            <meshStandardMaterial color={c ?? "#BC3D3B"} roughness={1} />
          </mesh>
          {[-0.4, 0, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.12, 1.3]} />
              <meshStandardMaterial color="#f4eee4" roughness={1} />
            </mesh>
          ))}
          <B p={[0.4, 0.12, 0.3]} s={[0.4, 0.24, 0.28]} c="#b98b5e" />
        </group>
      );
      break;
    case "water_cooler":
      body = (
        <group>
          <B p={[0, 0.5, 0]} s={[0.4, 1, 0.4]} c={IVORY} />
          <Cyl p={[0, 1.25, 0]} a={[0.16, 0.16, 0.5, 14]} c="#9cc8dc" r={0.1} />
        </group>
      );
      break;
    case "fridge_display": {
      const w = s.w ?? 1.2;
      body = (
        <group>
          <B p={[0, 1, 0]} s={[w, 2, 0.6]} c="#d8dcdf" r={0.3} />
          <mesh position={[0, 1.05, 0.305]}>
            <planeGeometry args={[w - 0.12, 1.7]} />
            <meshStandardMaterial color="#cfe3ea" emissive="#e9f4f8" emissiveIntensity={0.4} transparent opacity={0.6} />
          </mesh>
          {[0.5, 1.0, 1.5].map((y) =>
            Array.from({ length: Math.round(w / 0.2) }, (_, i) => <Cyl key={`${y}${i}`} p={[-w / 2 + 0.15 + i * 0.2, y, 0.15]} a={[0.05, 0.05, 0.22, 8]} c={["#BC3D3B", "#2f8a5f", "#c69c58"][(i + y * 2) % 3 | 0]} />),
          )}
        </group>
      );
      break;
    }
    case "booth": {
      const w = s.w ?? 2;
      body = (
        <group>
          <B p={[0, 0.74, 0]} s={[w - 0.2, 0.06, 0.8]} c={WOOD} />
          <Cyl p={[0, 0.37, 0]} a={[0.06, 0.08, 0.74, 8]} c={DARKWOOD} />
          {[-0.65, 0.65].map((z) => (
            <group key={z} position={[0, 0, z]} rotation={[0, z < 0 ? 0 : Math.PI, 0]}>
              <B p={[0, 0.25, 0]} s={[w, 0.5, 0.5]} c={c ?? "#5a1e24"} r={0.7} />
              <B p={[0, 0.85, -0.2]} s={[w, 0.8, 0.12]} c={c ?? "#5a1e24"} r={0.7} />
            </group>
          ))}
        </group>
      );
      break;
    }
    case "clothes_rail": {
      const w = s.w ?? 1.8;
      const cols = ["#BC3D3B", "#2F4A6B", "#C69C58", "#234C42", "#E9E2D3", "#7a3f8f", "#3A3A3A"];
      body = (
        <group>
          {[-w / 2, w / 2].map((x) => (
            <Cyl key={x} p={[x, 0.8, 0]} a={[0.02, 0.02, 1.6, 6]} c={STEEL} m={0.8} />
          ))}
          <Cyl p={[0, 1.6, 0]} a={[0.018, 0.018, w, 6]} c={STEEL} m={0.8} rot={[0, 0, Math.PI / 2]} />
          {Array.from({ length: Math.round(w / 0.18) }, (_, i) => (
            <B key={i} p={[-w / 2 + 0.12 + i * 0.18, 1.2, 0]} s={[0.05, 0.7, 0.42]} c={cols[(i * 3 + (s.v ?? 0)) % cols.length]} r={0.9} />
          ))}
        </group>
      );
      break;
    }
    case "pillar":
      body = <Cyl p={[0, 1.7, 0]} a={[0.22, 0.25, 3.4, 16]} c={c ?? IVORY} r={0.6} />;
      break;
  }
  return (
    <group position={[s.p[0], 0, s.p[1]]} rotation={[0, deg(s.r), 0]}>
      {body}
    </group>
  );
}

// ───────────────────────────── shell: floor and walls ─────────────────────────────

function WallPlane({ spec, w, h, night, windowColour }: { spec: WallSpec; w: number; h: number; night: boolean; windowColour: string }) {
  const tex = useMemo(() => {
    if (spec.kind === "brick") return brickTexture(spec.c ?? "#8e4e3e");
    if (spec.kind === "plaster") return plasterTexture(spec.c ?? "#e8dcc6", spec.c2 ?? "#cdb9a2");
    if (spec.kind === "panel") return panelTexture(spec.c ?? "#6b4a32");
    return null;
  }, [spec.kind, spec.c, spec.c2]);
  const repeat = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.repeat.set(w / 2, spec.kind === "plaster" ? 1 : h / 2);
    t.needsUpdate = true;
    return t;
  }, [tex, w, h, spec.kind]);
  if (spec.kind === "none") return null;
  if (spec.kind === "window" || spec.kind === "glass") {
    return (
      <group>
        <mesh position={[0, h / 2, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={windowColour} emissive={windowColour} emissiveIntensity={night ? 0.15 : 0.5} transparent={spec.kind === "glass"} opacity={spec.kind === "glass" ? 0.5 : 1} />
        </mesh>
        {Array.from({ length: Math.floor(w / 2) + 1 }, (_, i) => (
          <B key={i} p={[-w / 2 + i * (w / Math.floor(w / 2)), h / 2, 0.05]} s={[0.08, h, 0.1]} c="#2b2f36" cast={false} />
        ))}
        <B p={[0, 0.1, 0.05]} s={[w, 0.2, 0.12]} c="#2b2f36" cast={false} />
      </group>
    );
  }
  return (
    <mesh position={[0, h / 2, -0.1]} receiveShadow>
      <boxGeometry args={[w, h, 0.2]} />
      <meshStandardMaterial map={repeat ?? undefined} color="#ffffff" roughness={0.95} />
    </mesh>
  );
}

export function ShellView({ shell, night, windowColour }: { shell: Shell; night: boolean; windowColour: string }) {
  const [w, d] = shell.size;
  const h = shell.height ?? 3.4;
  const tex = useMemo(() => {
    const t = floorTexture(shell.floor.kind, shell.floor.c1, shell.floor.c2).clone();
    t.repeat.set(w / 2, d / 2);
    t.needsUpdate = true;
    return t;
  }, [shell.floor.kind, shell.floor.c1, shell.floor.c2, w, d]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex} roughness={shell.floor.kind === "tiles" || shell.floor.kind === "checker" ? 0.45 : 0.9} />
      </mesh>
      {shell.outdoor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[w * 4, d * 4]} />
          <meshStandardMaterial color={shell.floor.kind === "grass" ? "#5d7f4c" : "#9a9790"} roughness={1} />
        </mesh>
      )}
      {!shell.outdoor && (
        <>
          <mesh position={[0, -0.15, d / 2 + 0.02]}>
            <boxGeometry args={[w + 0.4, 0.3, 0.06]} />
            <meshStandardMaterial color="#3a2e26" />
          </mesh>
          <mesh position={[w / 2 + 0.02, -0.15, 0]}>
            <boxGeometry args={[0.06, 0.3, d + 0.4]} />
            <meshStandardMaterial color="#3a2e26" />
          </mesh>
        </>
      )}
      {shell.back && (
        <group position={[0, 0, -d / 2]}>
          <WallPlane spec={shell.back} w={w} h={h} night={night} windowColour={windowColour} />
        </group>
      )}
      {shell.left && (
        <group position={[-w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <WallPlane spec={shell.left} w={d} h={h} night={night} windowColour={windowColour} />
        </group>
      )}
    </group>
  );
}

/** Ambient bob for hotspot markers. */
export function useBob(ref: React.RefObject<Group | null>, base: number) {
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = base + Math.sin(clock.getElapsedTime() * 2.4) * 0.06;
  });
}
