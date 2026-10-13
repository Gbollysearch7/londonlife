"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useControls, type Nearby } from "./controls";

/**
 * Keeps the orbit camera centred on the player: the target eases towards your character and the camera
 * moves with it, so you can still rotate and zoom freely. `pull` 0–1 blends between the scene centre and you.
 */
export function FollowCamera({ base, pull = 0.85, height = 0.8 }: { base: [number, number, number]; pull?: number; height?: number }) {
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const { camera } = useThree();
  const want = useRef(new Vector3());
  const delta = useRef(new Vector3());
  useFrame((_, dt) => {
    if (!controls) return;
    const p = useControls.getState().player;
    want.current.set(base[0] + (p.x - base[0]) * pull, height, base[2] + (p.z - base[2]) * pull);
    delta.current.subVectors(want.current, controls.target).multiplyScalar(1 - Math.exp(-Math.min(dt, 0.1) * 5));
    controls.target.add(delta.current);
    camera.position.add(delta.current);
    controls.update();
  });
  return null;
}

export interface Interactable {
  id: string;
  label: string;
  pos: [number, number];
  open: () => void;
}

/** Finds the closest interactable within reach of the player and offers it as "Press E". */
export function ProximityWatcher({ items, reach = 1.6 }: { items: Interactable[]; reach?: number }) {
  const list = useRef(items);
  list.current = items;
  const last = useRef<string | null>(null);
  useEffect(() => () => useControls.getState().setNearby(null), []);
  useFrame(() => {
    const p = useControls.getState().player;
    let best: Interactable | null = null;
    let bestD = reach;
    for (const it of list.current) {
      const d = Math.hypot(it.pos[0] - p.x, it.pos[1] - p.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    const id = best?.id ?? null;
    if (id !== last.current) {
      last.current = id;
      const n: Nearby | null = best ? { id: best.id, label: best.label, open: best.open } : null;
      useControls.getState().setNearby(n);
    } else if (best) {
      // Keep the open handler fresh (state changes) without re-rendering every frame.
      const cur = useControls.getState().nearby;
      if (cur) cur.open = best.open;
    }
  });
  return null;
}
