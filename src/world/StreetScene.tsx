"use client";
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, InstancedMesh } from "three";
import { Object3D } from "three";
import { venue } from "@/content/world";
import type { State } from "@/client/api";
import { serverNow } from "@/client/store";
import Avatar from "./Avatar";
import { TextLabel } from "./TextLabel";
import type { Lighting } from "./lighting";

const BRICKS = ["#8b4b3c", "#7c4337", "#9a5a44", "#6f3f35", "#a36a52"];
const STUCCO = ["#efe6d6", "#e6dcc8"];
const DOORS = ["#234C42", "#BC3D3B", "#2F4A6B", "#17232B", "#C69C58"];

function seeded(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Terrace({ x, i, night, sign }: { x: number; i: number; night: boolean; sign?: { name: string; colour: string } }) {
  const floors = 2 + Math.floor(seeded(i) * 2);
  const h = floors * 1.35 + 0.6;
  const w = 2.4;
  const stucco = seeded(i + 7) > 0.72;
  const wall = stucco ? STUCCO[i % 2] : BRICKS[i % BRICKS.length];
  const lit = (k: number) => night && seeded(i * 10 + k) > 0.45;
  return (
    <group position={[x, 0, -5.6]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 2]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      {/* parapet / roof variety */}
      {seeded(i + 3) > 0.5 ? (
        <mesh position={[0, h + 0.45, -0.2]} rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.01, 1.4, 0.9, 4, 1]} />
          <meshStandardMaterial color="#4e4a50" roughness={0.8} />
        </mesh>
      ) : (
        <mesh position={[0, h + 0.12, 0]}>
          <boxGeometry args={[w + 0.06, 0.24, 2.06]} />
          <meshStandardMaterial color={stucco ? "#d6ccb8" : "#6b3a30"} />
        </mesh>
      )}
      <mesh position={[0.8, h + 0.5, -0.6]}>
        <boxGeometry args={[0.35, 0.6, 0.35]} />
        <meshStandardMaterial color="#6b3a30" />
      </mesh>
      {/* windows */}
      {Array.from({ length: floors }, (_, f) =>
        [-0.55, 0.55].map((wx, k) => (
          <mesh key={`${f}${k}`} position={[wx, 1.9 + f * 1.35, 1.01]}>
            <planeGeometry args={[0.6, 0.85]} />
            <meshStandardMaterial color={lit(f * 2 + k) ? "#ffd58a" : "#8ea3b3"} emissive={lit(f * 2 + k) ? "#ffb85a" : "#2a3846"} emissiveIntensity={lit(f * 2 + k) ? 0.9 : 0.35} roughness={0.15} metalness={0.2} />
          </mesh>
        )),
      )}
      {/* ground floor: shopfront or front door */}
      {sign ? (
        <group position={[0, 0, 1.02]}>
          <mesh position={[0, 0.85, 0]}>
            <planeGeometry args={[2.1, 1.3]} />
            <meshStandardMaterial color="#ffe3a8" emissive="#ffc46a" emissiveIntensity={night ? 0.8 : 0.25} />
          </mesh>
          <mesh position={[0, 1.7, 0.08]}>
            <boxGeometry args={[2.4, 0.38, 0.12]} />
            <meshStandardMaterial color={sign.colour} />
          </mesh>
          <mesh position={[0, 1.42, 0.35]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[2.3, 0.04, 0.7]} />
            <meshStandardMaterial color={sign.colour} />
          </mesh>
          <TextLabel text={sign.name} colour="#f4eee4" background={null} font="700 64px Georgia, serif" billboard={false} position={[0, 1.7, 0.15]} height={0.26} />
        </group>
      ) : (
        <group position={[0.4, 0, 1.02]}>
          <mesh position={[0, 0.95, 0]}>
            <planeGeometry args={[0.8, 1.9]} />
            <meshStandardMaterial color={DOORS[i % DOORS.length]} />
          </mesh>
          <mesh position={[-1.05, 1.1, 0]}>
            <planeGeometry args={[0.7, 0.9]} />
            <meshStandardMaterial color={lit(9) ? "#ffd58a" : "#8ea3b3"} emissive={lit(9) ? "#ffb85a" : "#2a3846"} emissiveIntensity={lit(9) ? 0.8 : 0.35} roughness={0.15} />
          </mesh>
        </group>
      )}
      {/* railings */}
      <mesh position={[0, 0.45, 1.6]}>
        <boxGeometry args={[w, 0.04, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

function Rain({ on }: { on: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const count = 500;
  const drops = useMemo(() => Array.from({ length: count }, (_, i) => [seeded(i) * 60 - 30, seeded(i + 99) * 8, seeded(i + 199) * 12 - 6]), []);
  const tmp = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    if (!ref.current || !on) return;
    drops.forEach((d, i) => {
      d[1] -= dt * 9;
      if (d[1] < 0) d[1] += 8;
      tmp.position.set(d[0], d[1], d[2]);
      tmp.updateMatrix();
      ref.current!.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  if (!on) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.015, 0.35, 0.015]} />
      <meshBasicMaterial color="#cfd8e0" transparent opacity={0.5} />
    </instancedMesh>
  );
}

function Bus({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[5.2, 2.7, 1.6]} />
        <meshStandardMaterial color="#BC3D3B" roughness={0.5} />
      </mesh>
      {[0.95, 2.2].map((y) => (
        <mesh key={y} position={[0, y, 0.81]}>
          <planeGeometry args={[4.8, 0.6]} />
          <meshStandardMaterial color="#e9eef0" emissive="#ffe6b0" emissiveIntensity={0.25} roughness={0.15} />
        </mesh>
      ))}
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.32, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.25, 18]} />
          <meshStandardMaterial color="#17232b" />
        </mesh>
      ))}
    </group>
  );
}

export default function StreetScene({ state, light }: { state: State; light: Lighting }) {
  const j = state.journey!;
  const from = venue(j.origin)!.street.x;
  const to = venue(j.destination)!.street.x;
  const avatar = useRef<Group>(null);
  const bus = useRef<Group>(null);
  const { camera } = useThree();
  const start = new Date(j.departedAt).getTime();
  const end = new Date(j.arrivesAt).getTime();

  useFrame(() => {
    const t = Math.min(1, Math.max(0, (serverNow() - start) / Math.max(1, end - start)));
    const x = from + (to - from) * t;
    if (avatar.current) {
      avatar.current.position.x = x;
      avatar.current.rotation.y = to > from ? Math.PI / 2 : -Math.PI / 2;
    }
    if (bus.current) {
      bus.current.position.set(x, 0, 2.2);
      bus.current.rotation.y = to > from ? 0 : Math.PI;
    }
    camera.position.x += (x + 2 - camera.position.x) * 0.06;
    camera.lookAt(camera.position.x - 2, 1.4, -1);
  });

  const signs: Record<number, { name: string; colour: string }> = {};
  signs[Math.round((venue("food_hall")!.street.x + 24) / 2.4)] = { name: "Common Table", colour: "#234C42" };
  signs[Math.round((venue("common_room")!.street.x + 24) / 2.4)] = { name: "The Common Room", colour: "#2F4A6B" };

  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.fog, 14, 42]} />
      <hemisphereLight args={["#fff4e6", "#5f5348", light.ambient]} />
      <directionalLight position={[8, 14, 10]} intensity={light.sunIntensity} color={light.sun} castShadow shadow-mapSize={[2048, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {/* road, kerbs, pavements */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 2.2]} receiveShadow>
        <planeGeometry args={[80, 4.2]} />
        <meshStandardMaterial color={state.weather.id === "rain" ? "#3b4149" : "#4a4f55"} roughness={state.weather.id === "rain" ? 0.35 : 0.9} />
      </mesh>
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-38 + i * 4, -0.01, 2.2]}>
          <planeGeometry args={[1.6, 0.12]} />
          <meshStandardMaterial color="#e8e2d0" />
        </mesh>
      ))}
      <mesh position={[0, 0.06, -2.4]} receiveShadow>
        <boxGeometry args={[80, 0.12, 5]} />
        <meshStandardMaterial color="#9aa0a3" roughness={state.weather.id === "rain" ? 0.4 : 0.95} />
      </mesh>
      <mesh position={[0, 0.06, 5.2]} receiveShadow>
        <boxGeometry args={[80, 0.12, 1.8]} />
        <meshStandardMaterial color="#9aa0a3" />
      </mesh>
      {Array.from({ length: 21 }, (_, i) => (
        <Terrace key={i} i={i} x={-24 + i * 2.4} night={light.night} sign={signs[i]} />
      ))}
      <TextLabel text="Home" position={[venue("home")!.street.x, 2.9, -4.2]} height={0.4} />
      {/* trees and streetlights */}
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[-22 + i * 5.5, 0, -0.6]}>
          {i % 2 === 0 ? (
            <>
              <mesh position={[0, 1.2, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.14, 2.4, 8]} />
                <meshStandardMaterial color="#4a3a2c" />
              </mesh>
              <mesh position={[0, 2.9, 0]} castShadow>
                <icosahedronGeometry args={[1.1, 1]} />
                <meshStandardMaterial color={i % 4 ? "#4f7a46" : "#5d8650"} roughness={0.9} flatShading />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 1.8, 0]}>
                <cylinderGeometry args={[0.05, 0.07, 3.6, 8]} />
                <meshStandardMaterial color="#1a1f24" />
              </mesh>
              <mesh position={[0, 3.6, 0.25]}>
                <boxGeometry args={[0.25, 0.25, 0.4]} />
                <meshStandardMaterial color="#fff1c8" emissive="#ffcf7a" emissiveIntensity={light.night ? 1.5 : 0.1} />
              </mesh>
              {light.night && <pointLight position={[0, 3.4, 0.4]} intensity={6} distance={8} color="#ffcf8a" />}
            </>
          )}
        </group>
      ))}
      <Rain on={state.weather.id === "rain" || state.weather.id === "drizzle"} />
      {j.mode === "bus" ? (
        <Bus groupRef={bus} />
      ) : (
        <group ref={avatar} position={[from, 0.12, -1.6]}>
          <Avatar appearance={state.character.appearance} pose="walk" />
        </group>
      )}
    </>
  );
}
