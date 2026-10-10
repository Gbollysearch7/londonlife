"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { State } from "@/client/api";
import HomeScene from "./HomeScene";
import StreetScene from "./StreetScene";
import VenueScene from "./VenueScene";
import { lightingFor } from "./lighting";

export default function World({ state }: { state: State }) {
  const hour = Number(state.clock.slice(0, 2));
  const light = lightingFor(hour, state.weather.id);
  const view = state.journey ? "street" : state.character.location === "home" ? "home" : "venue";
  const grid = Math.max(state.home.tier.gridW, state.home.tier.gridD);
  // Portrait screens need the camera further back to frame the same scene.
  const k = typeof window !== "undefined" && window.innerWidth < window.innerHeight ? 1.55 : 1;
  const camera =
    view === "home"
      ? { position: [grid * 0.95 * k, grid * 1.05 * k, grid * 1.25 * k] as [number, number, number], fov: 40 }
      : view === "street"
        ? { position: [0, 4.5 * k, 13 * k] as [number, number, number], fov: 42 }
        : { position: [5 * k, 7 * k, 10 * k] as [number, number, number], fov: 42 };
  return (
    <Canvas
      key={`${view}-${state.character.location}`}
      shadows
      dpr={[1, 1.75]}
      camera={camera}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      aria-label={view === "home" ? "Your home" : view === "street" ? "Camden street" : "Venue interior"}
    >
      <Suspense fallback={null}>
        {view === "home" && <HomeScene state={state} light={light} />}
        {view === "venue" && <VenueScene state={state} light={light} />}
        {view === "street" && <StreetScene state={state} light={light} />}
      </Suspense>
    </Canvas>
  );
}
