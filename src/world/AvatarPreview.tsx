"use client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import type { Appearance } from "@/content/character";
import Avatar from "./Avatar";

export default function AvatarPreview({ appearance }: { appearance: Appearance }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.35, 3.6], fov: 32 }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)} aria-label="Character preview">
      <color attach="background" args={["#e9dfcf"]} />
      <hemisphereLight args={["#fff4e0", "#8a7a6a", 0.9]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow />
      <group position={[0, -0.05, 0]} rotation={[0, -0.35, 0]}>
        <Avatar appearance={appearance} pose="idle" />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[0.9, 40]} />
        <meshStandardMaterial color="#d8cbb6" />
      </mesh>
      <ContactShadows position={[0, -0.04, 0]} opacity={0.4} blur={2.4} scale={3} />
    </Canvas>
  );
}
