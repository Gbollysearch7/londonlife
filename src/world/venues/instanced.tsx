"use client";
/**
 * Instanced versions of venue props that repeat one shape many times (spec ch. 36: reuse instancing).
 * A bookcase used to cost ~70 draw calls (one mesh and material per spine), a bunting line ~12 and a dance
 * floor 12–20; each is now a single draw call with per-instance colour, drawn exactly where it was before.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type InstancedMesh } from "three";
import { useProfile } from "@/client/graphics";

export interface Piece {
  p: [number, number, number];
  /** Scale of the unit shape (for boxes: width, height, depth). */
  s: [number, number, number];
  c: string;
  rot?: [number, number, number];
}

const tmp = new Object3D();

function useInstances(items: Piece[]) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const col = new Color();
    items.forEach((it, i) => {
      tmp.position.set(...it.p);
      tmp.rotation.set(...(it.rot ?? [0, 0, 0]));
      tmp.scale.set(...it.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return ref;
}

/** Unit boxes scaled per piece, one draw call. */
export function InstancedBoxes({ items, roughness = 0.8, castShadow = true }: { items: Piece[]; roughness?: number; castShadow?: boolean }) {
  const ref = useInstances(items);
  return (
    <instancedMesh key={items.length} ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}

/** Bunting pennants along a sagging line (same layout as the original per-mesh version). */
export function InstancedBunting({ w }: { w: number }) {
  const items = useMemo(() => {
    const n = Math.round(w / 0.8);
    return Array.from({ length: n }, (_, i): Piece => ({
      p: [-w / 2 + (i + 0.5) * (w / n), -Math.sin((i / (n - 1)) * Math.PI) * 0.25, 0],
      s: [1, 1, 1],
      c: ["#BC3D3B", "#C69C58", "#234C42", "#2F4A6B"][i % 4],
      rot: [0, 0, Math.PI],
    }));
  }, [w]);
  const ref = useInstances(items);
  return (
    <instancedMesh key={items.length} ref={ref} args={[undefined, undefined, items.length]}>
      <coneGeometry args={[0.16, 0.3, 3]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}

/** Book spines on a bookcase's four shelves (same layout and colours as before). */
export function InstancedBooks({ w }: { w: number }) {
  const items = useMemo(() => {
    const cols = ["#234C42", "#BC3D3B", "#C69C58", "#2F4A6B", "#7a6a5a", "#e9e2d3"];
    return [0.3, 0.85, 1.4, 1.95].flatMap((y, row) =>
      Array.from({ length: Math.round(w / 0.11) - 1 }, (_, i): Piece => ({
        p: [-w / 2 + 0.12 + i * 0.11, y + 0.16, 0.1],
        s: [0.085, 0.32 - ((i + row) % 3) * 0.05, 0.26],
        c: cols[(i * 3 + row * 2) % cols.length],
      })),
    );
  }, [w]);
  return <InstancedBoxes items={items} />;
}

/**
 * Light-up dance floor tiles. Unlit tiles with per-instance colour stand in for the old per-tile emissive
 * glow. With reduced motion the floor stays lit but never flashes.
 */
export function InstancedDanceFloor({ w = 4, d = 3 }: { w?: number; d?: number }) {
  const cols = Math.round(w);
  const rows = Math.round(d);
  const { motion } = useProfile();
  const palette = useMemo(() => ["#bc3d3b", "#c69c58", "#2f4a6b", "#7a3f8f", "#2f8a5f"].map((h) => new Color(h)), []);
  const items = useMemo(
    () =>
      Array.from({ length: cols * rows }, (_, i): Piece => ({
        p: [(i % cols) - (cols - 1) / 2, 0.012, Math.floor(i / cols) - (rows - 1) / 2],
        s: [0.96, 0.96, 1],
        c: "#ffffff",
        rot: [-Math.PI / 2, 0, 0],
      })),
    [cols, rows],
  );
  const ref = useInstances(items);
  const col = useMemo(() => new Color(), []);
  const lastOn = useRef<boolean[]>([]);
  const paint = (m: InstancedMesh, i: number, level: number) => {
    m.setColorAt(i, col.copy(palette[(i * 7) % palette.length]).multiplyScalar(level));
  };
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < items.length; i++) paint(m, i, 0.9);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    lastOn.current = [];
  }, [items, motion]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || !motion) return;
    const t = clock.getElapsedTime();
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const on = Math.sin(t * 3 + (i % cols) * 1.3 + Math.floor(i / cols) * 0.7) > 0.3;
      if (lastOn.current[i] === on) continue;
      lastOn.current[i] = on;
      paint(m, i, on ? 1.6 : 0.55);
      changed = true;
    }
    if (changed && m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh key={items.length} ref={ref} args={[undefined, undefined, items.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
