"use client";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { create } from "zustand";
import { useGraphics } from "@/client/graphics";

/**
 * Render-cost controls that live inside the Canvas (spec ch. 36 performance):
 * adaptive resolution that steps down when frames drop and back up when there is headroom,
 * and an optional measurement probe (frames per second, draw calls, triangles, pixel ratio).
 */

export interface PerfStats {
  fps: number;
  calls: number;
  triangles: number;
  dpr: number;
}

export const usePerfStats = create<{ stats: PerfStats | null }>(() => ({ stats: null }));

/** Moves the canvas pixel ratio within `range` based on measured frame rate. Falls back to the minimum if it keeps flip-flopping. */
export function AdaptiveResolution({ range }: { range: [number, number] }) {
  const setDpr = useThree((s) => s.setDpr);
  const [min, max] = range;
  const apply = (factor: number) => setDpr(Math.round((min + (max - min) * factor) * 4) / 4);
  return <PerformanceMonitor factor={1} flipflops={3} onChange={({ factor }) => apply(factor)} onFallback={() => setDpr(min)} />;
}

/** Samples frame rate and renderer counters once a second while stats are switched on. */
export function PerfProbe() {
  const show = useGraphics((g) => g.showStats);
  const frames = useRef(0);
  const since = useRef(0);
  useFrame(({ gl, clock }) => {
    if (!show) return;
    frames.current++;
    const t = clock.getElapsedTime();
    if (!since.current) since.current = t;
    if (t - since.current >= 1) {
      usePerfStats.setState({
        stats: {
          fps: Math.round(frames.current / (t - since.current)),
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          dpr: Math.round(gl.getPixelRatio() * 100) / 100,
        },
      });
      frames.current = 0;
      since.current = t;
    }
  });
  return null;
}

/** Small readout over the 3D view (Settings → Graphics → Show performance stats). */
export function PerfOverlay() {
  const show = useGraphics((g) => g.showStats);
  const quality = useGraphics((g) => g.quality);
  const stats = usePerfStats((s) => s.stats);
  if (!show) return null;
  return (
    <div
      role="status"
      aria-label="Performance stats"
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        zIndex: 5,
        pointerEvents: "none",
        background: "rgba(23,35,43,0.82)",
        color: "#fbf8f2",
        font: "12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: "6px 8px",
        borderRadius: 8,
      }}
    >
      {stats ? `${stats.fps} fps · ${stats.calls} draws · ${Math.round(stats.triangles / 1000)}k tris · dpr ${stats.dpr} · ${quality}` : "Measuring…"}
    </div>
  );
}
