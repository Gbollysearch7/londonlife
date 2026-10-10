"use client";
import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { APPEARANCE_OPTIONS, type Appearance } from "@/content/character";

export type Pose = "idle" | "walk" | "sit" | "sleep" | "work" | "wave";

function Hair({ style, colour }: { style: number; colour: string }) {
  const mat = <meshStandardMaterial color={colour} roughness={0.85} />;
  switch (style) {
    case 0: // short crop
      return (
        <mesh position={[0, 0.05, -0.01]} castShadow>
          <sphereGeometry args={[0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          {mat}
        </mesh>
      );
    case 1: // curls
      return (
        <group>
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const r = i % 2 ? 0.17 : 0.12;
            return (
              <mesh key={i} position={[Math.cos(a) * r, 0.14 + (i % 3) * 0.03, Math.sin(a) * r - 0.02]} castShadow>
                <icosahedronGeometry args={[0.09, 0]} />
                {mat}
              </mesh>
            );
          })}
          <mesh position={[0, 0.2, -0.02]}>
            <icosahedronGeometry args={[0.12, 0]} />
            {mat}
          </mesh>
        </group>
      );
    case 2: // locs
      return (
        <group>
          <mesh position={[0, 0.06, -0.01]}>
            <sphereGeometry args={[0.222, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.2, -0.1, -Math.sin(a) * 0.2]} castShadow>
                <cylinderGeometry args={[0.028, 0.024, 0.34, 6]} />
                {mat}
              </mesh>
            );
          })}
        </group>
      );
    case 3: // braids
      return (
        <group>
          <mesh position={[0, 0.06, -0.01]}>
            <sphereGeometry args={[0.222, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, -0.16, -0.12]} rotation={[0.25, 0, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.03, 0.42, 6]} />
              {mat}
            </mesh>
          ))}
        </group>
      );
    case 4: // bob
      return (
        <group>
          <mesh position={[0, 0.02, -0.01]} castShadow>
            <sphereGeometry args={[0.24, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.65]} />
            {mat}
          </mesh>
        </group>
      );
    default: // shaved
      return (
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.207, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
          <meshStandardMaterial color={colour} roughness={1} transparent opacity={0.55} />
        </mesh>
      );
  }
}

export default function Avatar({ appearance, pose = "idle", children, ...props }: { appearance: Appearance; pose?: Pose } & ThreeElements["group"]) {
  const skin = APPEARANCE_OPTIONS.skin[appearance.skin] ?? APPEARANCE_OPTIONS.skin[0];
  const hair = APPEARANCE_OPTIONS.hairColour[appearance.hairColour] ?? APPEARANCE_OPTIONS.hairColour[0];
  const top = APPEARANCE_OPTIONS.top[appearance.top] ?? APPEARANCE_OPTIONS.top[0];
  const bottom = APPEARANCE_OPTIONS.bottom[appearance.bottom] ?? APPEARANCE_OPTIONS.bottom[0];
  const shoes = APPEARANCE_OPTIONS.shoes[appearance.shoes] ?? APPEARANCE_OPTIONS.shoes[0];
  const b = appearance.body === 1;
  const shoulder = b ? 0.19 : 0.22;
  const hip = b ? 0.17 : 0.15;

  const root = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const body = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const swing = pose === "walk" ? Math.sin(t * 8) * 0.6 : 0;
    if (legL.current && legR.current) {
      const sitAngle = pose === "sit" ? -Math.PI / 2 : 0;
      legL.current.rotation.x = sitAngle + swing;
      legR.current.rotation.x = sitAngle - swing;
    }
    if (armL.current && armR.current) {
      armL.current.rotation.x = pose === "work" ? -1.1 + Math.sin(t * 6) * 0.25 : -swing * 0.8;
      armR.current.rotation.x = pose === "work" ? -1.1 + Math.cos(t * 6) * 0.25 : swing * 0.8;
      armR.current.rotation.z = pose === "wave" ? 2.6 + Math.sin(t * 8) * 0.3 : 0;
    }
    if (body.current) {
      body.current.position.y = pose === "walk" ? Math.abs(Math.sin(t * 8)) * 0.03 : Math.sin(t * 1.6) * 0.008;
    }
    if (root.current) {
      root.current.rotation.x = pose === "sleep" ? -Math.PI / 2 : 0;
    }
  });

  const sitDrop = pose === "sit" ? -0.38 : 0;

  return (
    <group {...props}>
      <group ref={root} position={[0, pose === "sleep" ? 0.55 : 0, 0]}>
        <group ref={body} position={[0, sitDrop, 0]}>
          {/* legs */}
          {[
            [-0.085, legL],
            [0.085, legR],
          ].map(([x, ref]) => (
            <group key={x as number} ref={ref as React.RefObject<Group>} position={[x as number, 0.78, 0]}>
              <mesh position={[0, -0.36, 0]} castShadow>
                <capsuleGeometry args={[0.068, 0.6, 4, 10]} />
                <meshStandardMaterial color={bottom} roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.75, 0.05]} castShadow>
                <boxGeometry args={[0.12, 0.08, 0.24]} />
                <meshStandardMaterial color={shoes} roughness={0.6} />
              </mesh>
            </group>
          ))}
          {/* hips */}
          <mesh position={[0, 0.82, 0]} castShadow>
            <boxGeometry args={[hip * 2 + 0.02, 0.16, 0.2]} />
            <meshStandardMaterial color={bottom} roughness={0.9} />
          </mesh>
          {/* torso */}
          <mesh position={[0, 1.13, 0]} castShadow>
            <capsuleGeometry args={[shoulder * 0.78, 0.3, 4, 14]} />
            <meshStandardMaterial color={top} roughness={0.85} />
          </mesh>
          {/* arms */}
          {[
            [-shoulder - 0.03, armL],
            [shoulder + 0.03, armR],
          ].map(([x, ref]) => (
            <group key={x as number} ref={ref as React.RefObject<Group>} position={[x as number, 1.34, 0]}>
              <mesh position={[0, -0.24, 0]} castShadow>
                <capsuleGeometry args={[0.055, 0.38, 4, 8]} />
                <meshStandardMaterial color={top} roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.5, 0]}>
                <sphereGeometry args={[0.055, 10, 8]} />
                <meshStandardMaterial color={skin} roughness={0.7} />
              </mesh>
            </group>
          ))}
          {/* neck + head */}
          <mesh position={[0, 1.42, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
          <group position={[0, 1.64, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.2, 24, 18]} />
              <meshStandardMaterial color={skin} roughness={0.65} />
            </mesh>
            {[-0.07, 0.07].map((x) => (
              <mesh key={x} position={[x, 0.02, 0.185]}>
                <sphereGeometry args={[0.022, 8, 6]} />
                <meshStandardMaterial color="#17232B" />
              </mesh>
            ))}
            <mesh position={[0, -0.07, 0.19]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#6b2f2a" />
            </mesh>
            <Hair style={appearance.hairStyle} colour={hair} />
          </group>
        </group>
      </group>
      {children}
    </group>
  );
}
