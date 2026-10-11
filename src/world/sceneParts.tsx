"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { BackSide, Color, type Group, type Mesh, type ShaderMaterial } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { TextLabel } from "./TextLabel";
import type { Lighting } from "./lighting";
import { useProfile } from "@/client/graphics";

/** Gradient sky sphere (zenith → horizon) that follows the lighting model. */
export function SkyDome({ light }: { light: Lighting }) {
  const mat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ top: { value: new Color(light.skyTop) }, bottom: { value: new Color(light.sky) } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  uniforms.top.value.set(light.skyTop);
  uniforms.bottom.value.set(light.sky);
  return (
    <mesh scale={180} renderOrder={-10}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        ref={mat}
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }`}
      />
    </mesh>
  );
}

/** Key light with soft shadows framed to the scene, plus sky/ground fill. */
export function SceneLights({ light, size, interior = true }: { light: Lighting; size: number; interior?: boolean }) {
  const s = size * 0.75;
  const { shadowMapSize } = useProfile(); // smaller shadow maps on small screens and Low quality
  return (
    <>
      {/* Interiors keep warm room light after dark so they never become unreadable (spec ch. 28 lighting). */}
      <hemisphereLight args={[interior && light.night ? "#ffe2bf" : light.hemiSky, light.hemiGround, interior ? Math.max(light.ambient + 0.15, light.night ? 0.75 : 0) : light.ambient]} />
      <directionalLight
        position={[size * 0.55, size * 1.2, size * 0.75]}
        intensity={light.sunIntensity * (interior ? 0.85 : 1)}
        color={light.sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-far={size * 4}
      />
      {light.night && <ambientLight intensity={0.12} color="#8fa6d8" />}
    </>
  );
}

/** Pulsing floor ring + bobbing icon chip that opens a hotspot's actions. */
export function HotspotMarker({
  pos,
  label,
  icon,
  onSelect,
  active,
  highlight,
}: {
  pos: [number, number];
  label: string;
  icon: string;
  onSelect: () => void;
  active?: boolean;
  highlight?: boolean;
}) {
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const ring = useRef<Mesh>(null);
  const chip = useRef<Group>(null);
  const { motion } = useProfile();
  useFrame(({ clock }) => {
    const t = motion ? clock.getElapsedTime() : 0; // reduced motion: markers stay still
    if (ring.current) {
      const k = 1 + Math.sin(t * 3) * 0.06;
      ring.current.scale.set(k, k, k);
      (ring.current.material as { opacity: number }).opacity = (hover || active ? 0.85 : highlight ? 0.7 : 0.42) + Math.sin(t * 3) * 0.08;
    }
    if (chip.current) chip.current.position.y = 2.25 + Math.sin(t * 2.2 + pos[0]) * 0.05;
  });
  const handle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onSelect();
  };
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh
        ref={ring}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onClick={handle}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial color={highlight ? "#c69c58" : "#fbf8f2"} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={handle} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#c69c58" transparent opacity={hover || active ? 0.35 : 0.12} depthWrite={false} />
      </mesh>
      <group ref={chip} onClick={handle} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
        <TextLabel text={hover || active ? `${icon}  ${label}` : icon} position={[0, 0, 0]} height={hover || active ? 0.3 : 0.26} background={highlight ? "rgba(198,156,88,0.96)" : "rgba(251,248,242,0.94)"} />
      </group>
    </group>
  );
}

/** Invisible click catcher over a walkable floor; ignores drags so camera orbit doesn't trigger a walk. */
export function WalkPlane({ size, onWalk, centre = [0, 0] }: { size: [number, number]; onWalk: (x: number, z: number) => void; centre?: [number, number] }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[centre[0], 0.004, centre[1]]}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onWalk(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Brief expanding ring where the player tapped to walk. */
export function TapRipple({ at }: { at: { x: number; z: number; n: number } | null }) {
  const ref = useRef<Mesh>(null);
  const born = useRef(0);
  const last = useRef(0);
  useFrame(() => {
    if (!ref.current || !at) return;
    if (at.n !== last.current) {
      last.current = at.n;
      born.current = performance.now();
    }
    const age = (performance.now() - born.current) / 600;
    ref.current.visible = age < 1;
    ref.current.position.set(at.x, 0.03, at.z);
    const k = 0.3 + age * 0.8;
    ref.current.scale.set(k, k, k);
    (ref.current.material as { opacity: number }).opacity = Math.max(0, 0.8 * (1 - age));
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.35, 0.45, 32]} />
      <meshBasicMaterial color="#fbf8f2" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
