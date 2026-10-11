"use client";
/**
 * Original procedural furniture kit. Each model is authored at rotation 0, centred on its footprint,
 * front facing +Z. One grid cell = 1 unit. Footprints match the catalogue exactly.
 */
import type { ReactNode } from "react";
import { ArtModel } from "./venues/kit_a";

const M = ({ c, r = 0.8, m = 0, e }: { c: string; r?: number; m?: number; e?: string }) => (
  <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? "#000"} emissiveIntensity={e ? 1 : 0} />
);

function Box({ p, s, c, r, m }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; m?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <M c={c} r={r} m={m} />
    </mesh>
  );
}

const WOOD = "#b98b5e";
const DARK = "#2b2f36";
const WHITE = "#f2f0ea";
const STEEL = "#a9b0b5";

function Bed({ w, colour }: { w: number; colour: string }) {
  return (
    <group>
      <Box p={[0, 0.18, 0]} s={[w * 0.92, 0.22, 1.9]} c={WOOD} />
      <Box p={[0, 0.62, -0.93]} s={[w * 0.92, 0.9, 0.08]} c={WOOD} />
      <Box p={[0, 0.36, 0.02]} s={[w * 0.86, 0.16, 1.8]} c={WHITE} r={0.95} />
      <Box p={[0, 0.46, 0.25]} s={[w * 0.88, 0.08, 1.3]} c={colour} r={0.95} />
      {Array.from({ length: w }, (_, i) => (
        <Box key={i} p={[(i - (w - 1) / 2) * 0.9, 0.5, -0.7]} s={[w === 1 ? 0.6 : 0.7, 0.12, 0.3]} c={WHITE} r={1} />
      ))}
    </group>
  );
}

function Seat({ w, colour }: { w: number; colour: string }) {
  return (
    <group>
      <Box p={[0, 0.22, 0.02]} s={[w * 0.9, 0.22, 0.8]} c={colour} r={0.95} />
      <Box p={[0, 0.55, -0.33]} s={[w * 0.9, 0.55, 0.18]} c={colour} r={0.95} />
      <Box p={[-w * 0.45 + 0.07, 0.4, 0]} s={[0.14, 0.4, 0.8]} c={colour} r={0.95} />
      <Box p={[w * 0.45 - 0.07, 0.4, 0]} s={[0.14, 0.4, 0.8]} c={colour} r={0.95} />
      {Array.from({ length: w }, (_, i) => (
        <Box key={i} p={[(i - (w - 1) / 2) * (w === 1 ? 0 : 0.78), 0.38, 0.05]} s={[w === 1 ? 0.6 : 0.74, 0.1, 0.62]} c={colour} r={1} />
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (w * 0.42), 0.05, sz * 0.33]} s={[0.06, 0.1, 0.06]} c={DARK} />))}
    </group>
  );
}

function Counter({ children, colour = "#e8e2d6" }: { children?: ReactNode; colour?: string }) {
  return (
    <group>
      <Box p={[0, 0.43, 0]} s={[0.9, 0.86, 0.8]} c={colour} />
      <Box p={[0, 0.88, 0]} s={[0.94, 0.05, 0.84]} c="#5a5550" r={0.4} />
      <Box p={[0, 0.45, 0.405]} s={[0.8, 0.7, 0.01]} c="#d9d2c4" />
      {children}
    </group>
  );
}

export function FurnitureModel({ defId, colour, w, d }: { defId: string; colour: string; w: number; d: number }) {
  if (defId.startsWith("art_")) return <ArtModel defId={defId} colour={colour} />;
  switch (defId) {
    case "single_bed":
      return <Bed w={1} colour={colour} />;
    case "double_bed":
      return <Bed w={2} colour={colour} />;
    case "armchair":
      return <Seat w={1} colour={colour} />;
    case "sofa":
      return <Seat w={2} colour={colour} />;
    case "toilet":
      return (
        <group position={[0, 0, -0.1]}>
          <Box p={[0, 0.2, 0.05]} s={[0.38, 0.4, 0.5]} c={colour} r={0.25} />
          <Box p={[0, 0.42, 0.08]} s={[0.42, 0.05, 0.52]} c={colour} r={0.25} />
          <Box p={[0, 0.62, -0.28]} s={[0.46, 0.5, 0.18]} c={colour} r={0.25} />
        </group>
      );
    case "shower":
      return (
        <group>
          <Box p={[0, 0.04, 0]} s={[0.92, 0.08, 0.92]} c={colour} r={0.3} />
          <mesh position={[0, 1.05, 0.44]}>
            <boxGeometry args={[0.9, 1.9, 0.02]} />
            <meshStandardMaterial color="#cfe3ea" transparent opacity={0.28} roughness={0.05} />
          </mesh>
          <mesh position={[0.44, 1.05, 0]}>
            <boxGeometry args={[0.02, 1.9, 0.9]} />
            <meshStandardMaterial color="#cfe3ea" transparent opacity={0.28} roughness={0.05} />
          </mesh>
          <Box p={[-0.3, 1.0, -0.42]} s={[0.04, 1.6, 0.04]} c={STEEL} m={0.8} r={0.3} />
          <Box p={[-0.3, 1.82, -0.32]} s={[0.22, 0.04, 0.22]} c={STEEL} m={0.8} r={0.3} />
        </group>
      );
    case "camp_hob":
      return (
        <Counter>
          {[-0.18, 0.18].map((x) => (
            <mesh key={x} position={[x, 0.915, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.13, 20]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          ))}
        </Counter>
      );
    case "cooker":
      return (
        <group>
          <Box p={[0, 0.45, 0]} s={[0.9, 0.9, 0.8]} c={colour} r={0.35} />
          <Box p={[0, 0.4, 0.405]} s={[0.7, 0.45, 0.01]} c={DARK} r={0.2} />
          <Box p={[0, 0.7, 0.42]} s={[0.6, 0.03, 0.03]} c={STEEL} m={0.8} />
          {[-0.2, 0.2].flatMap((x) =>
            [-0.18, 0.18].map((z) => (
              <mesh key={`${x}${z}`} position={[x, 0.91, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.06, 0.1, 18]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
            )),
          )}
        </group>
      );
    case "fridge":
      return (
        <group>
          <Box p={[0, 0.9, 0]} s={[0.78, 1.8, 0.72]} c={colour} r={0.3} />
          <Box p={[0, 1.25, 0.365]} s={[0.76, 0.01, 0.01]} c="#bbb" />
          <Box p={[0.3, 1.45, 0.38]} s={[0.04, 0.3, 0.04]} c={STEEL} m={0.8} />
          <Box p={[0.3, 0.9, 0.38]} s={[0.04, 0.3, 0.04]} c={STEEL} m={0.8} />
        </group>
      );
    case "tv":
      return (
        <group>
          <Box p={[0, 0.25, -0.1]} s={[0.9, 0.5, 0.45]} c={WOOD} />
          <Box p={[0, 0.88, -0.15]} s={[0.92, 0.55, 0.05]} c={DARK} r={0.25} />
          <mesh position={[0, 0.88, -0.12]}>
            <planeGeometry args={[0.84, 0.47]} />
            <meshStandardMaterial color="#1f3b4d" emissive="#36607a" emissiveIntensity={0.5} />
          </mesh>
        </group>
      );
    case "bookshelf":
      return (
        <group position={[0, 0, -0.2]}>
          <Box p={[0, 0.9, 0]} s={[0.86, 1.8, 0.36]} c={colour} />
          {[0.35, 0.8, 1.25].map((y, row) =>
            Array.from({ length: 6 }, (_, i) => (
              <Box
                key={`${row}${i}`}
                p={[-0.32 + i * 0.12, y + 0.17, 0.05]}
                s={[0.09, 0.3 - ((i + row) % 3) * 0.04, 0.26]}
                c={["#234C42", "#BC3D3B", "#C69C58", "#2F4A6B", "#7a6a5a", "#e9e2d3"][(i + row * 2) % 6]}
              />
            )),
          )}
        </group>
      );
    case "desk":
      return (
        <group>
          <Box p={[0, 0.74, -0.05]} s={[1.8, 0.05, 0.7]} c={colour} />
          {[-0.85, 0.85].map((x) => (
            <Box key={x} p={[x, 0.37, -0.05]} s={[0.05, 0.74, 0.65]} c={colour} />
          ))}
          <Box p={[0.2, 0.775, -0.05]} s={[0.42, 0.02, 0.3]} c="#c9ced2" m={0.6} r={0.3} />
          <mesh position={[0.2, 0.92, -0.2]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.42, 0.28, 0.015]} />
            <meshStandardMaterial color="#c9ced2" metalness={0.6} roughness={0.3} />
          </mesh>
          <Box p={[-0.5, 0.82, -0.15]} s={[0.1, 0.12, 0.1]} c="#BC3D3B" />
          <Box p={[0, 0.43, 0.48]} s={[0.46, 0.05, 0.44]} c={DARK} />
          <Box p={[0, 0.72, 0.68]} s={[0.46, 0.5, 0.05]} c={DARK} />
          {[-0.19, 0.19].flatMap((x) => [0.3, 0.66].map((z) => <Box key={`${x}${z}`} p={[x, 0.21, z]} s={[0.04, 0.42, 0.04]} c={DARK} m={0.4} />))}
        </group>
      );
    case "guitar":
      return (
        <group rotation={[0, 0.3, 0]}>
          <Box p={[0, 0.25, -0.1]} s={[0.3, 0.04, 0.3]} c={DARK} />
          <group position={[0, 0.55, 0]} rotation={[-0.18, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.2, 0.22, 0.1, 20]} />
              <M c={colour} r={0.5} />
            </mesh>
            <mesh position={[0, 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.17, 0.1, 18]} />
              <M c={colour} r={0.5} />
            </mesh>
            <Box p={[0, 0.65, 0]} s={[0.06, 0.6, 0.04]} c="#3a2a1e" />
          </group>
        </group>
      );
    case "dumbbells":
      return (
        <group>
          <Box p={[0, 0.3, 0]} s={[0.8, 0.05, 0.5]} c={DARK} m={0.5} />
          <Box p={[0, 0.55, -0.1]} s={[0.8, 0.05, 0.3]} c={DARK} m={0.5} />
          {[-0.36, 0.36].map((x) => (
            <Box key={x} p={[x, 0.3, 0]} s={[0.05, 0.6, 0.5]} c={DARK} m={0.5} />
          ))}
          {[-0.2, 0, 0.2].map((x) => (
            <group key={x} position={[x, 0.37, 0.05]} rotation={[0, Math.PI / 2, 0]}>
              {[-0.1, 0.1].map((z) => (
                <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.055, 0.055, 0.06, 12]} />
                  <M c="#46505b" m={0.6} r={0.4} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    case "storage_chest":
      return (
        <group>
          <Box p={[0, 0.25, 0]} s={[0.8, 0.5, 0.55]} c={colour} />
          <Box p={[0, 0.52, 0]} s={[0.84, 0.05, 0.6]} c="#5a3f2a" />
          <Box p={[0, 0.4, 0.28]} s={[0.12, 0.08, 0.02]} c={STEEL} m={0.8} />
        </group>
      );
    case "plant":
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.14, 0.36, 16]} />
            <M c="#c06a4a" />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.12, 0.62 + (i % 3) * 0.12, Math.sin(a) * 0.12]} rotation={[Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]} castShadow>
                <sphereGeometry args={[0.16, 8, 6]} />
                <M c={i % 2 ? "#3e7a4f" : "#2f6340"} r={0.9} />
              </mesh>
            );
          })}
        </group>
      );
    case "lamp":
      return (
        <group>
          <Box p={[0, 0.02, 0]} s={[0.3, 0.04, 0.3]} c={DARK} />
          <Box p={[0, 0.75, 0]} s={[0.04, 1.45, 0.04]} c={DARK} m={0.6} />
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.13, 0.22, 0.28, 18, 1, true]} />
            <meshStandardMaterial color={colour} emissive="#ffd59a" emissiveIntensity={0.6} side={2} />
          </mesh>
          <pointLight position={[0, 1.4, 0]} intensity={1.2} distance={4} color="#ffcf8f" />
        </group>
      );
    case "rug":
      return (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w * 0.95, d * 0.95]} />
          <M c={colour} r={1} />
        </mesh>
      );
    case "poster":
      return (
        <group position={[0, 1.6, -0.47]}>
          <mesh>
            <planeGeometry args={[0.6, 0.85]} />
            <M c={colour} />
          </mesh>
          <mesh position={[0, 0.12, 0.002]}>
            <circleGeometry args={[0.18, 24]} />
            <M c="#f4eee4" />
          </mesh>
          <mesh position={[0, -0.25, 0.002]}>
            <planeGeometry args={[0.44, 0.08]} />
            <M c="#17232b" />
          </mesh>
        </group>
      );
    case "wall_clock":
      return (
        <group position={[0, 1.9, -0.47]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04, 28]} />
            <M c={colour} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <circleGeometry args={[0.19, 28]} />
            <M c="#fbf8f2" />
          </mesh>
        </group>
      );
    default:
      return <Box p={[0, 0.4, 0]} s={[w * 0.9, 0.8, d * 0.9]} c={colour} />;
  }
}
