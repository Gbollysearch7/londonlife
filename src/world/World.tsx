"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import type { State } from "@/client/api";
import { setScene, type Scene } from "@/client/sound";
import HomeScene from "./HomeScene";
import MapScene from "./MapScene";
import { useGame } from "@/client/store";
import StreetScene from "./StreetScene";
import TubeScene from "./TubeScene";
import VenueScene from "./VenueScene";
import VisitScene from "./VisitScene";
import { clockHour, lightingFor } from "./lighting";
import { useScene } from "./sceneStore";
import { LAYOUTS } from "./venues/layouts";

type View = "home" | "street" | "venue" | "map" | "visit";

function soundFor(view: View, state: State, night: boolean): Scene {
  const wet = state.weather.id === "rain" || state.weather.id === "drizzle";
  const music: Scene["music"] = night ? "night" : "calm";
  if (view === "map") return { layers: { city: 0.3, wind: 0.2 }, music };
  if (view === "street" && state.journey?.mode === "tube") return { layers: { city: 0.9, wind: 0.6 }, music };
  if (view === "street") return { layers: { city: 0.75, ...(wet ? { rain: 0.6 } : { birds: night ? 0 : 0.25 }) }, music };
  if (view === "home" || view === "visit") return { layers: { room: 0.35, ...(wet ? { rain: 0.22 } : {}) }, music };
  const layout = LAYOUTS[state.character.location];
  const outdoor = layout?.shell.outdoor;
  const base = layout?.sound ?? { layers: { room: 0.3 }, music };
  return {
    layers: { ...base.layers, ...(wet ? { rain: outdoor ? 0.6 : 0.15 } : {}) },
    music: base.music === "club" ? "club" : base.music === "off" ? "off" : music,
  };
}

export default function World({ state }: { state: State }) {
  const hour = clockHour(state.clock);
  const light = lightingFor(hour, state.weather.id);
  const sheet = useGame((x) => x.sheet);
  const mapFocus = useGame((x) => x.mapFocus);
  const setMapFocus = useGame((x) => x.setMapFocus);
  const visit = state.social?.visit ?? null;
  const view: View = sheet === "map" ? "map" : state.journey ? "street" : visit ? "visit" : state.character.location === "home" ? "home" : "venue";
  const grid = view === "visit" && visit ? Math.max(visit.home.gridW, visit.home.gridD) : Math.max(state.home.tier.gridW, state.home.tier.gridD);
  const sceneKey = `${view}-${view === "visit" ? visit?.hostId : state.character.location}`;
  // Portrait screens need the camera further back to frame the same scene.
  const k = typeof window !== "undefined" && window.innerWidth < window.innerHeight ? 1.55 : 1;
  const layout = LAYOUTS[state.character.location];
  const camera =
    view === "map"
      ? { position: [6 + 8 * k, 30 * k, 11 + 26 * k] as [number, number, number], fov: 40 }
      : view === "home" || view === "visit"
      ? { position: [grid * 0.95 * k, grid * 1.05 * k, grid * 1.25 * k] as [number, number, number], fov: 40 }
      : view === "street"
        ? state.journey?.mode === "tube"
          ? { position: [0, 1.5, 4.2 * k] as [number, number, number], fov: 50 }
          : { position: [0, 4.5 * k, 13 * k] as [number, number, number], fov: 42 }
        : { position: (layout?.camera.pos ?? [5, 7, 10]).map((v) => v * k) as [number, number, number], fov: 42 };

  useEffect(() => {
    setScene(soundFor(view, state, light.night));
  }, [view, state.character.location, state.weather.id, light.night]); // eslint-disable-line react-hooks/exhaustive-deps

  // A short fade masks the scene swap when you arrive somewhere new.
  const [fading, setFading] = useState(false);
  useEffect(() => {
    setFading(true);
    useScene.getState().reset();
    const t = setTimeout(() => setFading(false), 60);
    return () => clearTimeout(t);
  }, [sceneKey]);

  return (
    <>
      <Canvas
        key={sceneKey}
        shadows="soft"
        dpr={[1, 1.75]}
        camera={camera}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => useScene.getState().openHotspot(null)}
        aria-label={view === "map" ? "Map of London" : view === "visit" ? `${visit?.hostName}'s home (visiting)` : view === "home" ? "Your home" : view === "street" ? "London street" : "Venue interior"}
      >
        <Suspense fallback={null}>
          {view === "home" && <HomeScene state={state} light={light} />}
          {view === "visit" && visit && <VisitScene visit={visit} state={state} light={light} />}
          {view === "venue" && <VenueScene state={state} light={light} />}
          {view === "street" && (state.journey?.mode === "tube" ? <TubeScene state={state} /> : <StreetScene state={state} light={light} />)}
          {view === "map" && <MapScene state={state} light={light} selected={mapFocus} onSelect={setMapFocus} />}
        </Suspense>
      </Canvas>
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "#17232b", opacity: fading ? 1 : 0, transition: fading ? "none" : "opacity .45s", pointerEvents: "none" }}
      />
    </>
  );
}
