"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { venue } from "@/content/world";
import type { State } from "@/client/api";
import { serverNow } from "@/client/store";
import Avatar from "./Avatar";
import { Extra } from "./Crowd";
import { TextLabel } from "./TextLabel";

/** Inside a Tube carriage: rocking car, rushing tunnel lights and fellow passengers. */
export default function TubeScene({ state }: { state: State }) {
  const j = state.journey!;
  const car = useRef<Group>(null);
  const lights = useRef<Group>(null);
  const start = new Date(j.departedAt).getTime();
  const end = new Date(j.arrivesAt).getTime();
  const seats = useMemo(() => [-3.2, -2.4, -1.6, 1.6, 2.4, 3.2], []);
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const p = Math.min(1, Math.max(0, (serverNow() - start) / Math.max(1, end - start)));
    const speed = p > 0.92 ? Math.max(0.2, (1 - p) * 12) : Math.min(1, p * 12 + 0.2);
    if (car.current) {
      car.current.rotation.z = Math.sin(t * 2.3) * 0.012 * speed;
      car.current.position.y = Math.sin(t * 7.1) * 0.01 * speed;
    }
    if (lights.current) {
      for (const c of lights.current.children) {
        c.position.x -= dt * 30 * speed;
        if (c.position.x < -12) c.position.x += 24;
      }
    }
  });
  const dest = venue(j.destination)?.name ?? "";
  return (
    <>
      <color attach="background" args={["#0b0e12"]} />
      <hemisphereLight args={["#fff6e0", "#2a2622", 0.9]} />
      <pointLight position={[0, 2.2, 0]} intensity={8} distance={12} color="#fff1d0" />
      <group ref={lights}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-12 + i * 3, 1.5, -1.9]}>
            <boxGeometry args={[0.6, 0.08, 0.05]} />
            <meshBasicMaterial color="#ffcf8a" />
          </mesh>
        ))}
      </group>
      <group ref={car}>
        {/* floor, walls, ceiling */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[10, 0.1, 3]} />
          <meshStandardMaterial color="#5a5f66" />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[10, 0.1, 3]} />
          <meshStandardMaterial color="#e9e6df" />
        </mesh>
        <mesh position={[0, 1.25, -1.5]}>
          <boxGeometry args={[10, 2.5, 0.08]} />
          <meshStandardMaterial color="#e9e6df" />
        </mesh>
        {[-3, 0, 3].map((x) => (
          <mesh key={x} position={[x, 1.55, -1.45]}>
            <planeGeometry args={[1.8, 0.8]} />
            <meshStandardMaterial color="#121820" roughness={0.1} metalness={0.4} />
          </mesh>
        ))}
        {/* seats along the back wall */}
        {seats.map((x) => (
          <group key={x} position={[x, 0, -1.15]}>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.75, 0.1, 0.5]} />
              <meshStandardMaterial color="#2f4a6b" />
            </mesh>
            <mesh position={[0, 0.8, -0.24]}>
              <boxGeometry args={[0.75, 0.6, 0.08]} />
              <meshStandardMaterial color="#bc3d3b" />
            </mesh>
          </group>
        ))}
        {[-4, -0.6, 0.6, 4].map((x) => (
          <mesh key={x} position={[x, 1.25, 0.2]}>
            <cylinderGeometry args={[0.025, 0.025, 2.5, 8]} />
            <meshStandardMaterial color="#c9a63a" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 2.2, -1.42]}>
          <planeGeometry args={[4, 0.3]} />
          <meshBasicMaterial color="#17232b" />
        </mesh>
        <TextLabel text={`Next stop · ${dest}`} colour="#ffb000" background={null} font="700 56px system-ui, sans-serif" billboard={false} position={[0, 2.2, -1.41]} height={0.2} />
        <Avatar appearance={state.character.appearance} pose="sit" position={[0, 0, -1.15]} />
        <Extra seed={201} pos={[-2.4, -1.15]} rotY={0} pose="phone" y={0} />
        <Extra seed={202} pos={[2.4, -1.15]} rotY={0} pose="read" />
        <Extra seed={203} pos={[3.2, -1.15]} rotY={0} pose="sit" />
        <Extra seed={204} pos={[0.9, 0.3]} rotY={-90} pose="phone" />
      </group>
      <OrbitControls target={[0, 1.1, -0.6]} enablePan={false} minDistance={3} maxDistance={7} minPolarAngle={1.0} maxPolarAngle={1.45} minAzimuthAngle={-0.6} maxAzimuthAngle={0.6} />
    </>
  );
}
