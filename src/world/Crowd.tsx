"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Appearance } from "@/content/character";
import Avatar, { type Outfit } from "./Avatar";
import { findPath, cellCentre, isBlocked, type NavGrid, type P2 } from "./nav";
import type { Pose, Prop } from "./poses";

function rnd(seed: number, k: number) {
  const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic look for a background Londoner. */
export function appearanceFromSeed(seed: number): { appearance: Appearance; outfit: Outfit } {
  const pick = (k: number, n: number) => Math.floor(rnd(seed, k) * n);
  return {
    appearance: { body: pick(1, 2), skin: pick(2, 6), hairStyle: pick(3, 6), hairColour: pick(4, 6), top: pick(5, 6), bottom: pick(6, 5), shoes: pick(7, 4) },
    outfit: { top: pick(8, 5), bottom: pick(9, 4), hat: rnd(seed, 10) > 0.85 ? 1 + pick(11, 3) : 0, glasses: rnd(seed, 12) > 0.8, scarf: rnd(seed, 13) > 0.85 },
  };
}

/** A seated or standing extra that stays put (diners, colleagues, audience). */
export function Extra({ seed, pos, rotY, pose, prop, y = 0 }: { seed: number; pos: P2; rotY: number; pose: Pose; prop?: Prop; y?: number }) {
  const look = useMemo(() => appearanceFromSeed(seed), [seed]);
  return <Avatar appearance={look.appearance} outfit={look.outfit} pose={pose} prop={prop} phase={seed * 0.37} mood={rnd(seed, 20) > 0.5 ? "happy" : "neutral"} position={[pos[0], y, pos[1]]} rotation={[0, (rotY * Math.PI) / 180, 0]} />;
}

function randomFreePoint(grid: NavGrid, seed: number, k: number): P2 {
  for (let tries = 0; tries < 40; tries++) {
    const i = Math.floor(rnd(seed, k * 41 + tries) * grid.cols);
    const j = Math.floor(rnd(seed, k * 59 + tries * 3) * grid.rows);
    if (!isBlocked(grid, i, j)) return cellCentre(grid, i, j);
  }
  return cellCentre(grid, 0, 0);
}

/** A background walker that strolls between free spots, pausing now and then. */
function Walker({ grid, seed }: { grid: NavGrid; seed: number }) {
  const look = useMemo(() => appearanceFromSeed(seed), [seed]);
  const ref = useRef<Group>(null);
  const st = useRef({ pos: randomFreePoint(grid, seed, 0), path: [] as P2[], wait: rnd(seed, 3) * 3, leg: 1, rot: 0 });
  const [walking, setWalking] = useState(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) {
        s.path = findPath(grid, s.pos, randomFreePoint(grid, seed, s.leg++));
        if (s.path.length) setWalking(true);
        else s.wait = 2;
      }
    } else {
      const next = s.path[0];
      if (!next) {
        s.wait = 2 + rnd(seed, s.leg) * 5;
        setWalking(false);
      } else {
        const dx = next[0] - s.pos[0];
        const dz = next[1] - s.pos[1];
        const d = Math.hypot(dx, dz);
        const step = 1.1 * dt;
        if (d <= step) {
          s.pos = next;
          s.path.shift();
        } else s.pos = [s.pos[0] + (dx / d) * step, s.pos[1] + (dz / d) * step];
        s.rot = Math.atan2(dx, dz);
      }
    }
    if (ref.current) {
      ref.current.position.set(s.pos[0], 0, s.pos[1]);
      ref.current.rotation.y += (((s.rot - ref.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
    }
  });
  return (
    <group ref={ref}>
      <Avatar appearance={look.appearance} outfit={look.outfit} pose={walking ? "walk" : rnd(seed, 30) > 0.5 ? "phone" : "idle"} phase={seed * 0.71} />
    </group>
  );
}

export function Walkers({ grid, count, seedBase }: { grid: NavGrid; count: number; seedBase: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Walker key={i} grid={grid} seed={seedBase + i * 17} />
      ))}
    </>
  );
}
